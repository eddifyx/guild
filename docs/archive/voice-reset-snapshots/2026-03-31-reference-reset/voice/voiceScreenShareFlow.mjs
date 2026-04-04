function closeRefValue(ref) {
  if (!ref?.current) return;
  try {
    ref.current.close?.();
  } catch {}
  ref.current = null;
}

function stopStreamTracks(stream) {
  if (!stream?.getTracks) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop?.();
    } catch {}
  });
}

export async function cleanupVoiceScreenShareSession({
  refs = {},
  resetScreenShareAdaptationFn = () => {},
  setScreenSharingFn = () => {},
  setScreenShareStreamFn = () => {},
  setScreenShareErrorFn = () => {},
  setScreenShareDiagnosticsFn = () => {},
  socket = null,
  channelId = null,
  emitShareState = false,
  playStopChime = false,
  playStreamStopChimeFn = () => {},
  clearError = true,
} = {}) {
  closeRefValue(refs.screenShareAudioProducerRef);
  closeRefValue(refs.screenShareProducerRef);

  if (refs.screenShareStreamRef?.current) {
    stopStreamTracks(refs.screenShareStreamRef.current);
    refs.screenShareStreamRef.current = null;
  }

  closeRefValue(refs.screenSendTransportRef);

  if (refs.screenShareStatsRef) {
    refs.screenShareStatsRef.current = null;
  }

  resetScreenShareAdaptationFn();
  setScreenShareDiagnosticsFn(null);
  setScreenShareStreamFn(null);
  setScreenSharingFn(false);
  if (clearError) {
    setScreenShareErrorFn(null);
  }

  if (playStopChime) {
    playStreamStopChimeFn();
  }
  if (emitShareState && channelId && socket?.emit) {
    socket.emit('voice:screen-share-state', { channelId, sharing: false });
  }
}

export async function runVoiceScreenShareStartFlow({
  channelId = null,
  sourceId = null,
  includeAudio = true,
  macAudioDeviceId = null,
  participantIds = [],
  device = null,
  refs = {},
  ensureSecureMediaReadyFn = () => {},
  ensureVoiceKeyForParticipantsFn = async () => {},
  getOrCreateScreenSendTransportFn = async () => null,
  getRuntimeScreenShareCodecModeFn = () => 'auto',
  getPreferredScreenShareCodecCandidatesFn = () => [],
  screenShareProfiles = [],
  initialProfileIndex = 0,
  selectDesktopSourceFn = async () => {},
  getDisplayMediaFn = async () => null,
  getUserMediaFn = async () => null,
  resetScreenShareAdaptationFn = () => {},
  applyPreferredScreenShareConstraintsFn = async () => {},
  setScreenShareStreamFn = () => {},
  setScreenShareDiagnosticsFn = () => {},
  setVoiceE2EFn = () => {},
  setE2EWarningFn = () => {},
  setScreenShareErrorFn = () => {},
  setScreenSharingFn = () => {},
  playStreamStartChimeFn = () => {},
  cleanupVoiceScreenShareSessionFn = async () => {},
  publishScreenShareVideoProducerFn = async () => ({}),
  applySenderPreferencesFn = async () => null,
  attachSenderEncryptionFn = () => {},
  socket = null,
  onVideoTrackEndedFn = () => {},
  buildScreenShareStartErrorFn = async () => 'Screen sharing failed to start.',
  logScreenShareFailureContextFn = () => {},
  summarizeSelectedCodecFn = () => null,
  summarizeTrackSnapshotFn = () => null,
  summarizeScreenShareProfileFn = () => null,
  summarizeScreenShareHardwareFn = () => null,
  summarizeSenderParametersFn = () => null,
  getScreenShareRequestedCaptureFn = () => null,
  screenShareAudioMaxBitrate = null,
  nowIsoFn = () => new Date().toISOString(),
  warnFn = () => {},
} = {}) {
  try {
    ensureSecureMediaReadyFn('Screen sharing');
    await ensureVoiceKeyForParticipantsFn(participantIds, {
      activeChannelId: channelId,
      feature: 'Screen sharing',
    });

    const screenSendTransport = await getOrCreateScreenSendTransportFn(channelId);
    const screenShareCodecMode = getRuntimeScreenShareCodecModeFn();
    const screenShareCodecCandidates = getPreferredScreenShareCodecCandidatesFn(device, {
      preference: screenShareCodecMode,
    });
    const requestedScreenShareCodec = screenShareCodecCandidates[0] || null;
    const screenShareContentHint = includeAudio ? 'motion' : 'detail';
    const initialScreenShareProfile = screenShareProfiles[initialProfileIndex];

    if (sourceId) {
      await selectDesktopSourceFn?.(sourceId);
    }

    const stream = await getDisplayMediaFn({
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: includeAudio && !macAudioDeviceId,
    });

    if (refs.screenShareStreamRef) {
      refs.screenShareStreamRef.current = stream;
    }
    setScreenShareStreamFn(stream);

    const videoTrack = stream?.getVideoTracks?.()[0];
    if (!videoTrack) {
      throw new Error('Screen capture did not provide a video track.');
    }

    resetScreenShareAdaptationFn();
    await applyPreferredScreenShareConstraintsFn(videoTrack, initialScreenShareProfile);
    try {
      videoTrack.contentHint = screenShareContentHint;
    } catch {
      videoTrack.contentHint = includeAudio ? 'motion' : 'text';
    }
    videoTrack.onended = () => {
      onVideoTrackEndedFn();
    };

    setScreenShareDiagnosticsFn({
      active: true,
      startedAt: nowIsoFn(),
      requestedCapture: getScreenShareRequestedCaptureFn(initialScreenShareProfile),
      sourceId: sourceId || null,
      includeAudio,
      selectedCodecMode: screenShareCodecMode,
      requestedCodec: summarizeSelectedCodecFn(requestedScreenShareCodec),
      selectedCodec: null,
      e2eeMode: 'pending',
      requestedContentHint: screenShareContentHint,
      activeProfile: summarizeScreenShareProfileFn(initialScreenShareProfile),
      adaptation: {
        hardware: summarizeScreenShareHardwareFn(),
        lastReason: 'initial',
        lastChangedAt: nowIsoFn(),
        degradeSamples: 0,
        recoverySamples: 0,
      },
      captureTrack: summarizeTrackSnapshotFn(videoTrack),
      sender: null,
      sampledAt: null,
      producerMode: 'single',
    });

    const {
      producer,
      selectedScreenShareCodec,
      screenVideoBypassMode,
      bypassScreenVideoEncryption,
      senderParameters,
    } = await publishScreenShareVideoProducerFn({
      track: videoTrack,
      transport: screenSendTransport,
      profile: initialScreenShareProfile,
      screenShareCodecMode,
      simulcast: false,
    });

    if (refs.screenShareProducerRef) {
      refs.screenShareProducerRef.current = producer;
    }
    if (refs.screenShareSimulcastEnabledRef) {
      refs.screenShareSimulcastEnabledRef.current = false;
    }

    setScreenShareDiagnosticsFn((prev) => prev ? {
      ...prev,
      selectedCodec: summarizeSelectedCodecFn(selectedScreenShareCodec),
      e2eeMode: bypassScreenVideoEncryption ? screenVideoBypassMode : 'encrypted',
      senderParameters: senderParameters ? summarizeSenderParametersFn(senderParameters) : (prev.senderParameters || null),
    } : prev);

    let audioTrack = stream?.getAudioTracks?.()[0];
    if (!audioTrack && macAudioDeviceId && includeAudio) {
      try {
        const macAudioStream = await getUserMediaFn({
          audio: {
            deviceId: { exact: macAudioDeviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        audioTrack = macAudioStream?.getAudioTracks?.()[0];
        if (audioTrack) {
          refs.screenShareStreamRef?.current?.addTrack?.(audioTrack);
        }
      } catch (macAudioErr) {
        warnFn('[Voice] Failed to capture Mac virtual audio device:', macAudioErr);
      }
    }

    if (audioTrack) {
      const audioProducer = await screenSendTransport.produce({
        track: audioTrack,
        codecOptions: {
          opusDtx: true,
          opusFec: true,
          opusPtime: 20,
          opusMaxAverageBitrate: screenShareAudioMaxBitrate,
        },
        appData: { source: 'screen-audio' },
      });
      if (refs.screenShareAudioProducerRef) {
        refs.screenShareAudioProducerRef.current = audioProducer;
      }

      const audioSender = audioProducer.rtpSender;
      if (!audioSender) {
        throw new Error('Screen sharing is unavailable because secure media transforms could not attach to audio.');
      }

      try {
        await applySenderPreferencesFn(audioSender, {
          maxBitrate: screenShareAudioMaxBitrate,
          priority: 'medium',
          networkPriority: 'high',
        });
      } catch (audioSenderErr) {
        warnFn('[Voice] Failed to set screen share audio sender preferences:', audioSenderErr);
      }

      attachSenderEncryptionFn(audioSender, {
        kind: 'audio',
        codecMimeType: 'audio/opus',
      });
    }

    setVoiceE2EFn(true);
    setE2EWarningFn(null);
    setScreenShareErrorFn(null);
    setScreenSharingFn(true);
    playStreamStartChimeFn();
    socket?.emit?.('voice:screen-share-state', { channelId, sharing: true });

    return { started: true };
  } catch (err) {
    logScreenShareFailureContextFn({
      error: err,
      sourceId: sourceId || null,
      includeAudio,
      hasMacAudioDevice: Boolean(macAudioDeviceId),
    });

    await cleanupVoiceScreenShareSessionFn({
      emitShareState: false,
      playStopChime: false,
      clearError: false,
    });

    const cancelled = err?.name === 'NotAllowedError' || err?.name === 'AbortError';
    if (!cancelled) {
      const message = await buildScreenShareStartErrorFn(err, {
        sourceId: sourceId || null,
        includeAudio,
      });
      setScreenShareErrorFn(message);
      warnFn('Screen share failed:', err);
    }

    return {
      started: false,
      cancelled,
      error: err,
    };
  }
}
