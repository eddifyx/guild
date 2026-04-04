function normalizeVoiceJoinResponse(response) {
  if (!response || typeof response !== 'object') {
    throw new Error('Voice server did not return a valid join response.');
  }

  if (!response.rtpCapabilities || typeof response.rtpCapabilities !== 'object') {
    throw new Error('Voice server did not return media capabilities.');
  }

  return {
    rtpCapabilities: response.rtpCapabilities,
    existingProducers: Array.isArray(response.existingProducers) ? response.existingProducers : [],
    participants: Array.isArray(response.participants) ? response.participants : [],
  };
}

export async function runVoiceJoinFlow({
  chId = null,
  skipConnectChime = false,
  joinGen = null,
  getCurrentJoinGenFn = () => joinGen,
  currentChannelId = null,
  ensureSecureMediaReadyFn = () => {},
  resetVoiceSessionFn = async () => {},
  emitAsyncFn = async () => ({}),
  recordLaneDiagnosticFn = () => {},
  rememberUsersFn = () => {},
  getUntrustedVoiceParticipantsFn = () => [],
  buildVoiceTrustErrorFn = () => 'Voice trust check failed.',
  deviceCtor,
  setDeviceFn = () => {},
  createSendTransportFn = async () => null,
  createRecvTransportFn = async () => null,
  setChannelIdFn = () => {},
  setDeafenedFn = () => {},
  setVoiceChannelIdFn = () => {},
  setE2EWarningFn = () => {},
  syncVoiceParticipantsFn = async () => {},
  getVoiceParticipantIdsFn = () => [],
  updateVoiceDiagnosticsFn = () => {},
  consumeProducerFn = async () => {},
  syncVoiceE2EStateFn = () => {},
  playConnectChimeFn = () => {},
  getPlatformFn = () => null,
  prefetchDesktopSourcesFn = () => {},
  applyLiveCaptureToProducerFn = async () => null,
  setMutedFn = () => {},
  clearVoiceHealthProbeFn = () => {},
  voiceHealthProbeRetryCountRef = { current: 0 },
  scheduleVoiceHealthProbeFn = () => {},
  nowIsoFn = () => new Date().toISOString(),
} = {}) {
  const isCurrentJoin = () => getCurrentJoinGenFn() === joinGen;

  ensureSecureMediaReadyFn('Voice chat');

  if (currentChannelId) {
    await resetVoiceSessionFn({ notifyServer: true });
  }
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-reset' };
  }

  const {
    rtpCapabilities,
    existingProducers,
    participants,
  } = normalizeVoiceJoinResponse(await emitAsyncFn('voice:join', { channelId: chId }));
  recordLaneDiagnosticFn('voice', 'join_ack', {
    channelId: chId,
    participantCount: participants.length,
    existingProducerCount: existingProducers.length,
    codecCount: Array.isArray(rtpCapabilities?.codecs) ? rtpCapabilities.codecs.length : null,
  });
  rememberUsersFn(participants);
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-join-ack' };
  }

  const untrustedParticipants = getUntrustedVoiceParticipantsFn(participants);
  if (untrustedParticipants.length > 0) {
    throw new Error(buildVoiceTrustErrorFn(participants));
  }

  const device = new deviceCtor();
  await device.load({ routerRtpCapabilities: rtpCapabilities });
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-device-load' };
  }
  setDeviceFn(device);

  const sendTransport = await createSendTransportFn(chId);
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-send-transport', device, sendTransport };
  }
  await createRecvTransportFn(chId);
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-recv-transport', device, sendTransport };
  }

  setChannelIdFn(chId);
  setDeafenedFn(false);
  setVoiceChannelIdFn(chId);
  setE2EWarningFn(null);
  await syncVoiceParticipantsFn(participants, { channelId: chId });
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-sync-participants', device, sendTransport };
  }

  const participantIds = getVoiceParticipantIdsFn(participants);
  const requiresSecureVoice = participantIds.length > 1;
  updateVoiceDiagnosticsFn((prev) => ({
    ...prev,
    session: {
      active: true,
      channelId: chId,
      joinedAt: nowIsoFn(),
      participantCount: participantIds.length,
      existingProducerCount: existingProducers.length,
    },
  }));

  const voiceKey = await syncVoiceE2EStateFn(participantIds, {
    activeChannelId: chId,
    feature: 'Voice chat',
  });
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-sync-e2e', device, sendTransport, participantIds };
  }

  if (requiresSecureVoice && !voiceKey) {
    setMutedFn(true);
    clearVoiceHealthProbeFn();
    voiceHealthProbeRetryCountRef.current = 0;
    recordLaneDiagnosticFn('voice', 'secure_voice_unavailable', {
      channelId: chId,
      participantCount: participants.length,
    });
    return {
      aborted: false,
      ready: false,
      reason: 'secure_voice_unavailable',
      device,
      sendTransport,
      participantIds,
      participants,
      existingProducers,
      localCapture: null,
    };
  }

  await Promise.all(existingProducers.map(({ producerId, producerUserId, source }) => (
    consumeProducerFn(chId, producerId, producerUserId, source)
  )));
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-consume-existing', device, sendTransport, participantIds };
  }

  if (!skipConnectChime) {
    playConnectChimeFn();
  }

  if (getPlatformFn?.() !== 'darwin') {
    prefetchDesktopSourcesFn?.();
  }
  const localCapture = await applyLiveCaptureToProducerFn({ chId, sendTransport });
  if (!isCurrentJoin()) {
    return { aborted: true, phase: 'after-local-capture', device, sendTransport, participantIds };
  }

  if (!localCapture) {
    setMutedFn(true);
    clearVoiceHealthProbeFn();
    voiceHealthProbeRetryCountRef.current = 0;
    recordLaneDiagnosticFn('voice', 'local_capture_unavailable', {
      channelId: chId,
    });
    return {
      aborted: false,
      ready: false,
      reason: 'local_capture_unavailable',
      device,
      sendTransport,
      participantIds,
      participants,
      existingProducers,
      localCapture,
    };
  }

  voiceHealthProbeRetryCountRef.current = 0;
  scheduleVoiceHealthProbeFn(chId, { reason: 'join' });
  recordLaneDiagnosticFn('voice', 'join_ready', {
    channelId: chId,
    participantCount: participants.length,
  });

  return {
    aborted: false,
    ready: true,
    device,
    sendTransport,
    participantIds,
    participants,
    existingProducers,
    localCapture,
  };
}
