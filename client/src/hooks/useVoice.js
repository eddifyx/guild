import { useState, useRef, useCallback, useEffect } from 'react';
import { Device } from 'mediasoup-client';
import { DeepFilterNet3Core } from 'deepfilternet3-noise-filter';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { getServerUrl } from '../api';
import { playConnectChime, playStreamStartChime, playStreamStopChime } from '../utils/chime';
import {
  generateVoiceKey,
  getVoiceKey,
  setVoiceKey,
  clearVoiceKey,
  distributeVoiceKey,
  isInsertableStreamsSupported,
  attachSenderEncryption,
  attachReceiverDecryption,
  setVoiceChannelId,
  setVoiceChannelParticipants,
  waitForVoiceKey,
} from '../crypto/voiceEncryption';
import { isE2EInitialized } from '../crypto/sessionManager';
import { toBase64 } from '../crypto/primitives';
import { hasKnownNpub, rememberUsers } from '../crypto/identityDirectory.js';

export function useVoice() {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [channelId, setChannelId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [peers, setPeers] = useState({}); // { userId: { muted, deafened, speaking } }
  const [joinError, setJoinError] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [incomingScreenShares, setIncomingScreenShares] = useState([]); // [{ userId, stream }]
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [voiceE2E, setVoiceE2E] = useState(false); // Whether voice E2E encryption is active
  const [e2eWarning, setE2EWarning] = useState(null); // Warning message when E2E fails

  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producerRef = useRef(null);
  const consumersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const audioElementsRef = useRef(new Map());
  const userAudioRef = useRef(new Map()); // userId -> Map<producerId, HTMLAudioElement>
  const vadIntervalRef = useRef(null);
  const channelIdRef = useRef(null);
  const micAudioCtxRef = useRef(null);
  const micGainNodeRef = useRef(null);
  const screenShareProducerRef = useRef(null);
  const screenShareAudioProducerRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const screenShareVideosRef = useRef(new Map()); // producerId -> { userId, stream }
  const producerUserMapRef = useRef(new Map()); // producerId -> producerUserId
  const producerMetaRef = useRef(new Map()); // producerId -> { userId, kind, source }
  const deepFilterRef = useRef(null);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const participantIdsRef = useRef([]);
  const joinGenRef = useRef(0); // Generation counter to abort stale joins

  const syncIncomingScreenShares = useCallback(() => {
    setIncomingScreenShares(
      Array.from(screenShareVideosRef.current.values()).map(({ userId, stream }) => ({ userId, stream }))
    );
  }, []);

  const setUserAudioEntry = useCallback((userId, producerId, audio) => {
    let userAudioEntries = userAudioRef.current.get(userId);
    if (!userAudioEntries) {
      userAudioEntries = new Map();
      userAudioRef.current.set(userId, userAudioEntries);
    }
    userAudioEntries.set(producerId, audio);
  }, []);

  const removeUserAudioEntry = useCallback((userId, producerId) => {
    const userAudioEntries = userAudioRef.current.get(userId);
    if (!userAudioEntries) return;
    userAudioEntries.delete(producerId);
    if (userAudioEntries.size === 0) {
      userAudioRef.current.delete(userId);
    }
  }, []);

  const cleanupRemoteProducer = useCallback((producerId, { producerUserId = null, source = null } = {}) => {
    const consumer = consumersRef.current.get(producerId);
    if (consumer) {
      try { consumer.close(); } catch {}
      consumersRef.current.delete(producerId);
    }

    const producerMeta = producerMetaRef.current.get(producerId);
    const ownerId = producerUserId || producerMeta?.userId || producerUserMapRef.current.get(producerId);
    const producerSource = source || producerMeta?.source || null;

    const audio = audioElementsRef.current.get(producerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audioElementsRef.current.delete(producerId);
    }

    if (ownerId) {
      removeUserAudioEntry(ownerId, producerId);
    }

    if (producerSource === 'screen-video' || screenShareVideosRef.current.has(producerId)) {
      screenShareVideosRef.current.delete(producerId);
      syncIncomingScreenShares();
    }

    producerMetaRef.current.delete(producerId);
    producerUserMapRef.current.delete(producerId);
  }, [removeUserAudioEntry, syncIncomingScreenShares]);

  // Keep refs in sync
  useEffect(() => { channelIdRef.current = channelId; }, [channelId]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { deafenedRef.current = deafened; }, [deafened]);

  // Helper: emit with callback as promise
  const emitAsync = useCallback((event, data) => {
    return new Promise((resolve, reject) => {
      socket.emit(event, data, (res) => {
        if (!res) return reject(new Error('No response from server'));
        if (res.ok) resolve(res);
        else reject(new Error(res.error || 'Socket call failed'));
      });
    });
  }, [socket]);

  const ensureSecureMediaReady = useCallback((feature) => {
    if (!isE2EInitialized()) {
      throw new Error(feature + ' is unavailable until end-to-end encryption is ready.');
    }
    if (!isInsertableStreamsSupported()) {
      throw new Error(feature + ' is unavailable because this device does not support secure media transforms.');
    }
  }, []);

  const ensureVoiceKeyForParticipants = useCallback(async (participantIds, {
    activeChannelId = channelIdRef.current,
    feature = 'Voice chat',
    timeoutMs = 5000,
  } = {}) => {
    const currentUserId = user?.userId;
    const otherParticipantIds = Array.isArray(participantIds)
      ? participantIds.filter(id => id && id !== currentUserId)
      : [];

    if (!activeChannelId || !currentUserId || otherParticipantIds.length === 0) {
      return getVoiceKey();
    }

    const existingVoiceKey = getVoiceKey();
    if (existingVoiceKey) {
      return existingVoiceKey;
    }

    try {
      return await waitForVoiceKey(activeChannelId, timeoutMs);
    } catch {
      const currentOtherParticipants = participantIdsRef.current.filter(id => id && id !== currentUserId);
      if (channelIdRef.current !== activeChannelId || currentOtherParticipants.length === 0) {
        return getVoiceKey();
      }
      const lateVoiceKey = getVoiceKey();
      if (lateVoiceKey) {
        return lateVoiceKey;
      }
      throw new Error(`${feature} is unavailable because the secure media key did not arrive in time.`);
    }
  }, [user?.userId]);

  const getUntrustedVoiceParticipants = useCallback((participants) => {
    const normalizedParticipants = Array.isArray(participants)
      ? participants.filter(participant => participant?.userId)
      : [];
    return normalizedParticipants.filter(participant => (
      participant.userId !== user?.userId && !hasKnownNpub(participant.userId, participant.npub || null)
    ));
  }, [user?.userId]);

  const buildVoiceTrustError = useCallback((participants) => {
    const names = Array.from(new Set(
      getUntrustedVoiceParticipants(participants)
        .map(participant => participant.username || 'an untrusted participant')
    ));
    if (names.length === 0) {
      return 'Secure voice is waiting for every participant\'s Nostr identity.';
    }
    if (names.length === 1) {
      return `Secure voice is waiting for ${names[0]}'s Nostr identity.`;
    }
    if (names.length === 2) {
      return `Secure voice is waiting for ${names[0]} and ${names[1]}.`;
    }
    return `Secure voice is waiting for ${names.slice(0, 3).join(', ')}.`;
  }, [getUntrustedVoiceParticipants]);

  const syncVoiceParticipants = useCallback(async (participants, { channelId: activeChannelId = channelIdRef.current } = {}) => {
    const currentUserId = user?.userId;
    const normalizedParticipants = Array.isArray(participants)
      ? participants.filter(participant => participant?.userId)
      : [];
    const participantIds = Array.from(new Set(normalizedParticipants.map(participant => participant.userId)));
    const previousParticipantIds = participantIdsRef.current;

    participantIdsRef.current = participantIds;
    if (activeChannelId) {
      setVoiceChannelId(activeChannelId);
    }
    setVoiceChannelParticipants(participantIds);

    setPeers(() => {
      const nextPeers = {};
      for (const participant of normalizedParticipants) {
        if (participant.userId === currentUserId) continue;
        nextPeers[participant.userId] = {
          muted: !!participant.muted,
          deafened: !!participant.deafened,
          speaking: !!participant.speaking,
          screenSharing: !!participant.screenSharing,
        };
      }
      return nextPeers;
    });

    if (!activeChannelId || !currentUserId || !participantIds.includes(currentUserId) || !socket) {
      return;
    }

    const otherParticipantIds = participantIds.filter(id => id !== currentUserId);
    const previousOtherParticipantIds = previousParticipantIds.filter(id => id !== currentUserId);
    const addedParticipantIds = otherParticipantIds.filter(id => !previousOtherParticipantIds.includes(id));
    const removedParticipantIds = previousOtherParticipantIds.filter(id => !otherParticipantIds.includes(id));
    const membershipChanged = addedParticipantIds.length > 0 || removedParticipantIds.length > 0 || previousParticipantIds.length === 0;
    const leaderId = [...participantIds].sort()[0];

    // Do not mint a voice key while alone in the channel.
    // The eventual channel leader may be a different participant, and pre-generating
    // a solo key here can leave peers on different keys once someone joins.
    if (otherParticipantIds.length === 0) {
      if (previousOtherParticipantIds.length > 0) {
        clearVoiceKey({ preserveChannelState: true });
      }
      return;
    }

    let voiceKey = getVoiceKey();

    if (!voiceKey || removedParticipantIds.length > 0) {
      if (leaderId !== currentUserId) {
        return;
      }
      const { key, epoch } = generateVoiceKey();
      setVoiceKey(toBase64(key), epoch);
      voiceKey = { key, epoch };
      if (otherParticipantIds.length > 0) {
        await distributeVoiceKey(activeChannelId, otherParticipantIds, key, epoch, socket);
      }
      return;
    }

    if (membershipChanged && otherParticipantIds.length > 0) {
      await distributeVoiceKey(activeChannelId, otherParticipantIds, voiceKey.key, voiceKey.epoch, socket);
    }
  }, [socket, user?.userId]);

  const resetVoiceSession = useCallback(async ({ channelId: targetChannelId = channelIdRef.current, notifyServer = false } = {}) => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    if (deepFilterRef.current) {
      try { deepFilterRef.current.destroy?.(); } catch {}
      deepFilterRef.current = null;
    }

    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
      micGainNodeRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    if (screenShareAudioProducerRef.current) {
      screenShareAudioProducerRef.current.close();
      screenShareAudioProducerRef.current = null;
    }
    if (screenShareProducerRef.current) {
      screenShareProducerRef.current.close();
      screenShareProducerRef.current = null;
    }
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(t => t.stop());
      screenShareStreamRef.current = null;
    }
    setShowSourcePicker(false);
    setScreenSharing(false);
    setScreenShareStream(null);
    screenShareVideosRef.current.clear();
    setIncomingScreenShares([]);

    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }

    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }
    consumersRef.current.clear();
    producerUserMapRef.current.clear();
    producerMetaRef.current.clear();

    for (const audio of audioElementsRef.current.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    audioElementsRef.current.clear();
    userAudioRef.current.clear();

    if (sendTransportRef.current) {
      sendTransportRef.current.close();
      sendTransportRef.current = null;
    }
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
      recvTransportRef.current = null;
    }

    deviceRef.current = null;
    participantIdsRef.current = [];
    clearVoiceKey();
    setVoiceChannelParticipants([]);
    setVoiceE2E(false);
    setE2EWarning(null);

    if (notifyServer && targetChannelId && socket) {
      try { await emitAsync('voice:leave', { channelId: targetChannelId }); } catch {}
    }

    setChannelId(null);
    setMuted(false);
    setDeafened(false);
    setSpeaking(false);
    setPeers({});
  }, [socket, emitAsync]);

  // Start VAD (Voice Activity Detection) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â takes a GainNode so it reads the boosted signal
  const startVAD = useCallback((gainNode) => {
    try {
      const analyser = gainNode.context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      gainNode.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;
      let speechFrames = 0;   // consecutive frames above threshold
      let silenceFrames = 0;  // consecutive frames below threshold
      const SPEAK_THRESHOLD = 30;  // amplitude needed to count as speech
      const FRAMES_TO_ACTIVATE = 3;  // ~150ms of speech to trigger
      const FRAMES_TO_DEACTIVATE = 8; // ~400ms of silence to stop

      vadIntervalRef.current = setInterval(() => {
        // Don't report speaking while muted
        if (mutedRef.current) {
          if (wasSpeaking) {
            wasSpeaking = false;
            speechFrames = 0;
            silenceFrames = 0;
            setSpeaking(false);
            if (channelIdRef.current && socket) {
              socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: false });
            }
          }
          return;
        }
        analyser.getByteFrequencyData(data);
        // Skip bins below ~85Hz (fan/AC hum). Each bin = sampleRate / fftSize Hz.
        // At 48kHz with fftSize 512: bin width = 93.75Hz, so start at bin 1.
        // At 44.1kHz: bin width = 86.1Hz, same applies.
        const startBin = 1;
        let peak = 0;
        for (let i = startBin; i < data.length; i++) {
          if (data[i] > peak) peak = data[i];
        }
        const aboveThreshold = peak > SPEAK_THRESHOLD;

        if (aboveThreshold) {
          speechFrames++;
          silenceFrames = 0;
        } else {
          silenceFrames++;
          speechFrames = 0;
        }

        // Require sustained speech/silence to change state (debounce)
        let isSpeaking = wasSpeaking;
        if (!wasSpeaking && speechFrames >= FRAMES_TO_ACTIVATE) {
          isSpeaking = true;
        } else if (wasSpeaking && silenceFrames >= FRAMES_TO_DEACTIVATE) {
          isSpeaking = false;
        }

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          setSpeaking(isSpeaking);
          if (channelIdRef.current && socket) {
            socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: isSpeaking });
          }
        }
      }, 50);
    } catch (err) {
      console.error('VAD setup failed:', err);
    }
  }, [socket]);

  // Create send transport
  const createSendTransport = useCallback(async (chId) => {
    const { transportOptions } = await emitAsync('voice:create-transport', {
      channelId: chId, direction: 'send',
    });

    const transport = deviceRef.current.createSendTransport({
      ...transportOptions,
      additionalSettings: { encodedInsertableStreams: true },
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitAsync('voice:connect-transport', {
        channelId: chId, transportId: transport.id, dtlsParameters,
      }).then(callback).catch(errback);
    });

    transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
      emitAsync('voice:produce', {
        channelId: chId, transportId: transport.id, kind, rtpParameters, appData,
      }).then(({ producerId }) => callback({ id: producerId })).catch(errback);
    });

    sendTransportRef.current = transport;
    return transport;
  }, [emitAsync]);

  // Create recv transport
  const createRecvTransport = useCallback(async (chId) => {
    const { transportOptions } = await emitAsync('voice:create-transport', {
      channelId: chId, direction: 'recv',
    });

    const transport = deviceRef.current.createRecvTransport({
      ...transportOptions,
      additionalSettings: { encodedInsertableStreams: true },
    });

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      emitAsync('voice:connect-transport', {
        channelId: chId, transportId: transport.id, dtlsParameters,
      }).then(callback).catch(errback);
    });

    recvTransportRef.current = transport;
    return transport;
  }, [emitAsync]);

  // Consume a remote producer
  const consumeProducer = useCallback(async (chId, producerId, producerUserId, source = null) => {
    if (!deviceRef.current || !recvTransportRef.current) return;

    if (consumersRef.current.has(producerId)) return;

    const data = await emitAsync('voice:consume', {
      channelId: chId,
      producerId,
      producerUserId,
      rtpCapabilities: deviceRef.current.rtpCapabilities,
    });

    const consumer = await recvTransportRef.current.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });

    consumer.resume();

    try {
      const rtpReceiver = consumer.rtpReceiver;
      if (!rtpReceiver) {
        throw new Error('Voice media receiver is missing secure transform support.');
      }
      attachReceiverDecryption(rtpReceiver);
    } catch (e2eErr) {
      consumer.close();
      throw new Error('Voice chat is unavailable because end-to-end media decryption could not start.');
    }

    const producerSource = source || (data.kind === 'video' ? 'screen-video' : 'microphone');

    for (const [existingProducerId, meta] of producerMetaRef.current.entries()) {
      if (existingProducerId === producerId) continue;
      if (meta.userId !== producerUserId || meta.source !== producerSource) continue;
      cleanupRemoteProducer(existingProducerId, { producerUserId, source: producerSource });
    }

    consumersRef.current.set(producerId, consumer);
    producerUserMapRef.current.set(producerId, producerUserId);
    producerMetaRef.current.set(producerId, {
      userId: producerUserId,
      kind: data.kind,
      source: producerSource,
    });

    if (producerSource === 'screen-video') {
      const stream = new MediaStream([consumer.track]);
      screenShareVideosRef.current.set(producerId, { userId: producerUserId, stream });
      syncIncomingScreenShares();
      return;
    }

    const stream = new MediaStream([consumer.track]);
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;

    const outputId = localStorage.getItem('voice:outputDeviceId');
    if (outputId && audio.setSinkId) {
      audio.setSinkId(outputId).catch(() => {});
    }

    audioElementsRef.current.set(producerId, audio);
    setUserAudioEntry(producerUserId, producerId, audio);

    const savedVol = localStorage.getItem(`voice:userVolume:${producerUserId}`);
    if (savedVol !== null) audio.volume = parseFloat(savedVol);

    audio.play().catch(() => {
      const retry = () => {
        audio.play().catch(() => {});
        document.removeEventListener('click', retry);
        document.removeEventListener('keydown', retry);
      };
      document.addEventListener('click', retry, { once: true });
      document.addEventListener('keydown', retry, { once: true });
    });
  }, [cleanupRemoteProducer, emitAsync, setUserAudioEntry, syncIncomingScreenShares]);

  // Refs to hold callbacks defined later so earlier useCallbacks can reference them
  const leaveChannelRef = useRef(null);
  const stopScreenShareRef = useRef(null);

  // Join a voice channel
  const joinChannel = useCallback(async (chId) => {
    if (!socket) return;

    const gen = ++joinGenRef.current;
    setJoinError(null);
    setE2EWarning(null);

    try {
      ensureSecureMediaReady('Voice chat');

      if (channelIdRef.current) {
        await resetVoiceSession({ notifyServer: true });
      }
      if (gen !== joinGenRef.current) return;

      const { rtpCapabilities, existingProducers, participants = [] } = await emitAsync('voice:join', { channelId: chId });
      rememberUsers(participants);
      if (gen !== joinGenRef.current) return;

      const untrustedParticipants = getUntrustedVoiceParticipants(participants);
      if (untrustedParticipants.length > 0) {
        throw new Error(buildVoiceTrustError(participants));
      }

      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      if (gen !== joinGenRef.current) return;
      deviceRef.current = device;

      const sendTransport = await createSendTransport(chId);
      if (gen !== joinGenRef.current) return;
      await createRecvTransport(chId);
      if (gen !== joinGenRef.current) return;

      setChannelId(chId);
      setDeafened(false);
      setVoiceChannelId(chId);
      setE2EWarning(null);
      await syncVoiceParticipants(participants, { channelId: chId });
      if (gen !== joinGenRef.current) return;
      const participantIds = Array.from(new Set((participants || []).map(participant => participant?.userId).filter(Boolean)));
      if (participantIds.some(id => id !== user?.userId) && !getVoiceKey()) {
        setVoiceE2E(false);
      }
      await ensureVoiceKeyForParticipants(participantIds, { activeChannelId: chId, feature: 'Voice chat' });
      if (gen !== joinGenRef.current) return;
      await Promise.all(existingProducers.map(({ producerId, producerUserId, source }) =>
        consumeProducer(chId, producerId, producerUserId, source)
      ));
      if (gen !== joinGenRef.current) return;

      setVoiceE2E(true);
      playConnectChime();

      window.electronAPI?.prefetchDesktopSources?.();

      const deepFilterEnabled = localStorage.getItem('voice:noiseSuppression') !== 'false';
      const inputId = localStorage.getItem('voice:inputDeviceId');
      let stream = null;
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              noiseSuppression: false,
              echoCancellation: true,
              autoGainControl: true,
              latency: 0,
              ...(inputId ? { deviceId: { exact: inputId } } : {}),
            },
          });
        } catch (micErr) {
          console.warn('Saved mic device failed, trying default:', micErr);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { noiseSuppression: false, echoCancellation: true, autoGainControl: true, latency: 0 },
          });
        }
      } catch (micErr) {
        console.warn('Mic unavailable, joined without microphone:', micErr);
        setMuted(true);
      }

      if (stream) {
        localStreamRef.current = stream;

        const micCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
        micAudioCtxRef.current = micCtx;
        const micSource = micCtx.createMediaStreamSource(stream);
        const gainNode = micCtx.createGain();
        const savedGain = parseFloat(localStorage.getItem('voice:micGain') || '3');
        gainNode.gain.value = savedGain;
        micGainNodeRef.current = gainNode;

        try {
          const savedNsLevel = parseInt(localStorage.getItem('voice:nsLevel') || '80', 10);
          const deepfilterUrl = getServerUrl() + '/deepfilter';
          const dfCore = new DeepFilterNet3Core({ sampleRate: 48000, noiseReductionLevel: savedNsLevel, assetConfig: { cdnUrl: deepfilterUrl } });
          await dfCore.initialize();
          const dfNode = await dfCore.createAudioWorkletNode(micCtx);
          deepFilterRef.current = dfCore;
          dfCore.setNoiseSuppressionEnabled(deepFilterEnabled);
          micSource.connect(dfNode);
          dfNode.connect(gainNode);
          console.log('[Voice] DeepFilterNet3 loaded, suppression:', deepFilterEnabled);
        } catch (dfErr) {
          console.warn('[Voice] DeepFilterNet3 failed, using raw mic:', dfErr);
          micSource.connect(gainNode);
        }

        const dest = micCtx.createMediaStreamDestination();
        gainNode.connect(dest);

        const boostedTrack = dest.stream.getAudioTracks()[0];
        producerRef.current = await sendTransport.produce({ track: boostedTrack, appData: { source: 'microphone' } });

        const rtpSender = producerRef.current.rtpSender;
        if (!rtpSender) {
          throw new Error('Voice chat is unavailable because secure media transforms could not attach.');
        }
        attachSenderEncryption(rtpSender);

        startVAD(gainNode);
        setMuted(false);
      }
    } catch (err) {
      console.error('joinChannel failed:', err);
      const message = err?.message || 'Failed to join voice channel';
      await resetVoiceSession({ channelId: chId, notifyServer: true });
      setJoinError(message);
      setE2EWarning(message);
      setTimeout(() => setJoinError(null), 5000);
    }
  }, [socket, emitAsync, createSendTransport, createRecvTransport, consumeProducer, startVAD, ensureSecureMediaReady, ensureVoiceKeyForParticipants, resetVoiceSession, syncVoiceParticipants, user?.userId, getUntrustedVoiceParticipants, buildVoiceTrustError]);

  // Leave voice channel
  const leaveChannel = useCallback(async () => {
    joinGenRef.current += 1;
    await resetVoiceSession({ notifyServer: true });
  }, [resetVoiceSession]);

  // Keep ref in sync so joinChannel can call leaveChannel
  leaveChannelRef.current = leaveChannel;

  // Toggle mute ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â uses refs to avoid stale closure over muted state
  const toggleMute = useCallback(() => {
    if (!channelIdRef.current || !socket) return;
    const newMuted = !mutedRef.current;
    setMuted(newMuted);

    // Pause/resume producer
    if (producerRef.current) {
      if (newMuted) producerRef.current.pause();
      else producerRef.current.resume();
    }

    // Clear speaking state immediately when muting
    if (newMuted) {
      setSpeaking(false);
      socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: false });
    }

    socket.emit('voice:toggle-mute', { channelId: channelIdRef.current, muted: newMuted });
  }, [socket]);

  // Toggle deafen ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â uses refs to avoid stale closure over deafened/muted state
  const toggleDeafen = useCallback(() => {
    if (!channelIdRef.current || !socket) return;
    const newDeafened = !deafenedRef.current;
    setDeafened(newDeafened);

    // Mute all incoming audio
    for (const audio of audioElementsRef.current.values()) {
      audio.muted = newDeafened;
    }

    // Deafen on ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ also mute mic; Deafen off ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ also unmute mic
    if (newDeafened) {
      if (!mutedRef.current) {
        setMuted(true);
        if (producerRef.current) producerRef.current.pause();
        socket.emit('voice:toggle-mute', { channelId: channelIdRef.current, muted: true });
      }
    } else {
      setMuted(false);
      if (producerRef.current) producerRef.current.resume();
      socket.emit('voice:toggle-mute', { channelId: channelIdRef.current, muted: false });
    }

    socket.emit('voice:toggle-deafen', { channelId: channelIdRef.current, deafened: newDeafened });
  }, [socket]);

  // Toggle noise suppression (DeepFilterNet3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â live toggle via bypass)
  const toggleNoiseSuppression = useCallback((enabled) => {
    localStorage.setItem('voice:noiseSuppression', String(enabled));
    if (deepFilterRef.current) {
      deepFilterRef.current.setNoiseSuppressionEnabled(enabled);
    }
  }, []);

  // Set noise suppression level (0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“100, lower = more natural voice, higher = more filtering)
  const setNoiseSuppressionLevel = useCallback((level) => {
    localStorage.setItem('voice:nsLevel', String(level));
    if (deepFilterRef.current) {
      deepFilterRef.current.setSuppressionLevel(level);
    }
  }, []);

  // Set mic gain (sensitivity boost)
  const setMicGain = useCallback((gain) => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = gain;
    }
    localStorage.setItem('voice:micGain', String(gain));
  }, []);

  // Set volume for a specific user (0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1)
  const setUserVolume = useCallback((userId, volume) => {
    const userAudioEntries = userAudioRef.current.get(userId);
    if (userAudioEntries) {
      for (const audio of userAudioEntries.values()) {
        audio.volume = volume;
      }
    }
    localStorage.setItem(`voice:userVolume:${userId}`, String(volume));
  }, []);

  // Change output device for all audio elements
  const setOutputDevice = useCallback((deviceId) => {
    for (const audio of audioElementsRef.current.values()) {
      if (audio.setSinkId) audio.setSinkId(deviceId).catch(() => {});
    }
  }, []);

  // Confirm screen share with selected source
  // options: { sourceId, includeAudio, macAudioDeviceId } or string (legacy)
  const confirmScreenShare = useCallback(async (options) => {
    setShowSourcePicker(false);
    const sendTransport = sendTransportRef.current;
    if (!channelIdRef.current || !sendTransport) return;

    const sourceId = typeof options === 'string' ? options : options?.sourceId;
    const includeAudio = typeof options === 'string' ? true : options?.includeAudio !== false;
    const macAudioDeviceId = typeof options === 'string' ? null : options?.macAudioDeviceId;

    try {
      ensureSecureMediaReady('Screen sharing');
      await ensureVoiceKeyForParticipants(participantIdsRef.current, {
        activeChannelId: channelIdRef.current,
        feature: 'Screen sharing',
      });

      if (sourceId) {
        await window.electronAPI?.selectDesktopSource?.(sourceId);
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        audio: includeAudio && !macAudioDeviceId,
      });
      screenShareStreamRef.current = stream;
      setScreenShareStream(stream);

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.contentHint = 'motion';
      videoTrack.onended = () => {
        stopScreenShareRef.current?.();
      };

      const producer = await sendTransport.produce({
        track: videoTrack,
        encodings: [{ maxBitrate: 8_000_000, maxFramerate: 60 }],
        codecOptions: { videoGoogleStartBitrate: 3000 },
        appData: { source: 'screen-video' },
      });
      screenShareProducerRef.current = producer;

      let audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack && macAudioDeviceId && includeAudio) {
        try {
          const macAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: macAudioDeviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          });
          audioTrack = macAudioStream.getAudioTracks()[0];
          if (audioTrack) {
            screenShareStreamRef.current.addTrack(audioTrack);
          }
        } catch (macAudioErr) {
          console.warn('[Voice] Failed to capture Mac virtual audio device:', macAudioErr);
        }
      }

      if (audioTrack) {
        const audioProducer = await sendTransport.produce({ track: audioTrack, appData: { source: 'screen-audio' } });
        screenShareAudioProducerRef.current = audioProducer;
        const audioSender = audioProducer.rtpSender;
        if (!audioSender) {
          throw new Error('Screen sharing is unavailable because secure media transforms could not attach to audio.');
        }
        attachSenderEncryption(audioSender);
      }

      const videoSender = producer.rtpSender;
      if (!videoSender) {
        throw new Error('Screen sharing is unavailable because secure media transforms could not attach to video.');
      }
      attachSenderEncryption(videoSender);

      setVoiceE2E(true);
      setE2EWarning(null);
      setScreenSharing(true);
      playStreamStartChime();
      socket.emit('voice:screen-share-state', { channelId: channelIdRef.current, sharing: true });
    } catch (err) {
      if (screenShareAudioProducerRef.current) {
        screenShareAudioProducerRef.current.close();
        screenShareAudioProducerRef.current = null;
      }
      if (screenShareProducerRef.current) {
        screenShareProducerRef.current.close();
        screenShareProducerRef.current = null;
      }
      if (screenShareStreamRef.current) {
        screenShareStreamRef.current.getTracks().forEach(t => t.stop());
        screenShareStreamRef.current = null;
      }
      setScreenShareStream(null);
      setScreenSharing(false);

      const cancelled = err?.name === 'NotAllowedError' || err?.name === 'AbortError';
      if (!cancelled) {
        const message = err?.message || 'Secure screen sharing could not start.';
        setE2EWarning(message);
        console.warn('Screen share failed:', err);
      }
    }
  }, [socket, ensureSecureMediaReady, ensureVoiceKeyForParticipants]);

  // Open source picker to start screen sharing
  const startScreenShare = useCallback(() => {
    ensureSecureMediaReady('Screen sharing');
    if (!channelIdRef.current || !sendTransportRef.current) {
      throw new Error('Join a secure voice channel before starting screen share.');
    }
    setShowSourcePicker(true);
  }, [ensureSecureMediaReady]);

  // Cancel source picker
  const cancelSourcePicker = useCallback(() => {
    setShowSourcePicker(false);
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenShareAudioProducerRef.current) {
      screenShareAudioProducerRef.current.close();
      screenShareAudioProducerRef.current = null;
    }
    if (screenShareProducerRef.current) {
      screenShareProducerRef.current.close();
      screenShareProducerRef.current = null;
    }
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(t => t.stop());
      screenShareStreamRef.current = null;
    }
    setScreenSharing(false);
    setScreenShareStream(null);
    playStreamStopChime();
    if (channelIdRef.current && socket) {
      socket.emit('voice:screen-share-state', { channelId: channelIdRef.current, sharing: false });
    }
  }, [socket]);

  // Keep stopScreenShare ref in sync
  stopScreenShareRef.current = stopScreenShare;

  // Listen for voice events
  useEffect(() => {
    if (!socket) return;

    const handleChannelUpdate = ({ channelId: updatedChannelId, participants }) => {
      if (!updatedChannelId || updatedChannelId !== channelIdRef.current) return;
      const participantList = Array.isArray(participants) ? participants : [];
      rememberUsers(participantList);
      if (user?.userId && !participantList.some(participant => participant.userId === user.userId)) {
        return;
      }
      const untrustedParticipants = getUntrustedVoiceParticipants(participantList);
      if (untrustedParticipants.length > 0) {
        const message = buildVoiceTrustError(participantList);
        setJoinError(message);
        setE2EWarning(message);
        leaveChannelRef.current?.();
        return;
      }
      const participantIds = Array.from(new Set(participantList.map(participant => participant.userId)));
      syncVoiceParticipants(participantList, { channelId: updatedChannelId })
        .then(async () => {
          if (participantIds.some(id => id !== user?.userId) && !getVoiceKey()) {
            setVoiceE2E(false);
          }
          await ensureVoiceKeyForParticipants(participantIds, {
            activeChannelId: updatedChannelId,
            feature: 'Voice chat',
          });
          if (channelIdRef.current !== updatedChannelId) return;
          setVoiceE2E(true);
          setE2EWarning(null);
        })
        .catch(async (err) => {
          const message = err?.message || 'Secure voice could not synchronize channel participants.';
          setJoinError(message);
          setE2EWarning(message);
          await leaveChannelRef.current?.();
        });
    };

    const handleNewProducer = async ({ producerId, producerUserId, source }) => {
      if (channelIdRef.current) {
        try {
          await consumeProducer(channelIdRef.current, producerId, producerUserId, source);
        } catch (err) {
          const message = err?.message || 'Secure media setup failed for a new participant.';
          cleanupRemoteProducer(producerId, { producerUserId, source });
          setJoinError(message);
          setE2EWarning(message);
          setTimeout(() => {
            setJoinError((current) => (current === message ? null : current));
          }, 5000);
        }
      }
    };

    const handleProducerClosed = ({ producerId, producerUserId, source }) => {
      if (producerId) {
        cleanupRemoteProducer(producerId, { producerUserId, source });
        return;
      }

      for (const [prodId, ownerId] of producerUserMapRef.current.entries()) {
        if (ownerId !== producerUserId) continue;
        cleanupRemoteProducer(prodId, { producerUserId, source });
      }
    };
    const handlePeerMute = ({ userId, muted, deafened }) => {
      setPeers(prev => ({
        ...prev,
        [userId]: { ...prev[userId], muted, deafened },
      }));
    };

    const handlePeerSpeaking = ({ userId, speaking }) => {
      setPeers(prev => ({
        ...prev,
        [userId]: { ...prev[userId], speaking },
      }));
    };

    const handleChannelDeleted = async ({ channelId: deletedChannelId }) => {
      if (!deletedChannelId || deletedChannelId !== channelIdRef.current) return;
      setJoinError('This voice channel was deleted.');
      setTimeout(() => setJoinError(null), 5000);
      await resetVoiceSession({ channelId: deletedChannelId, notifyServer: false });
    };

    socket.on('voice:channel-update', handleChannelUpdate);
    socket.on('voice:new-producer', handleNewProducer);
    socket.on('voice:producer-closed', handleProducerClosed);
    socket.on('voice:peer-mute-update', handlePeerMute);
    socket.on('voice:speaking', handlePeerSpeaking);
    socket.on('voice:channel-deleted', handleChannelDeleted);

    return () => {
      socket.off('voice:channel-update', handleChannelUpdate);
      socket.off('voice:new-producer', handleNewProducer);
      socket.off('voice:producer-closed', handleProducerClosed);
      socket.off('voice:peer-mute-update', handlePeerMute);
      socket.off('voice:speaking', handlePeerSpeaking);
      socket.off('voice:channel-deleted', handleChannelDeleted);
    };
  }, [socket, cleanupRemoteProducer, consumeProducer, syncVoiceParticipants, ensureVoiceKeyForParticipants, resetVoiceSession, user?.userId, getUntrustedVoiceParticipants, buildVoiceTrustError]);

  // Cleanup on unmount only ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â use ref to avoid re-running on leaveChannel identity change
  useEffect(() => {
    return () => {
      if (channelIdRef.current) leaveChannelRef.current?.();
    };
  }, []);

  return {
    channelId,
    muted,
    deafened,
    speaking,
    peers,
    joinError,
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    setOutputDevice,
    setUserVolume,
    setMicGain,
    toggleNoiseSuppression,
    setNoiseSuppressionLevel,
    screenSharing,
    screenShareStream,
    startScreenShare,
    stopScreenShare,
    incomingScreenShares,
    showSourcePicker,
    confirmScreenShare,
    cancelSourcePicker,
    voiceE2E,
    e2eWarning,
  };
}

