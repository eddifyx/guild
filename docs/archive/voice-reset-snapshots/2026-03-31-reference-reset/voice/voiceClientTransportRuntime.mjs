export function shouldEnableVoiceSendInsertableStreams({
  voiceSafeMode = false,
  disableVoiceInsertableStreams = false,
  insertableStreamsSupported = false,
  purpose = 'voice',
} = {}) {
  if (!insertableStreamsSupported) {
    return false;
  }
  return !((voiceSafeMode || disableVoiceInsertableStreams) && purpose !== 'screen');
}

export function shouldEnableVoiceRecvInsertableStreams({
  voiceSafeMode = false,
  disableVoiceInsertableStreams = false,
  insertableStreamsSupported = false,
} = {}) {
  return (
    !voiceSafeMode
    && !disableVoiceInsertableStreams
    && insertableStreamsSupported
  );
}

export function createClientVoiceSendTransport({
  device,
  transportOptions = {},
  chId = null,
  purpose = 'voice',
  emitAsyncFn = async () => ({}),
  recordLaneDiagnosticFn = () => {},
  voiceSafeMode = false,
  disableVoiceInsertableStreams = false,
  insertableStreamsSupported = false,
} = {}) {
  const encodedInsertableStreams = shouldEnableVoiceSendInsertableStreams({
    voiceSafeMode,
    disableVoiceInsertableStreams,
    insertableStreamsSupported,
    purpose,
  });

  const transport = device.createSendTransport({
    ...transportOptions,
    additionalSettings: encodedInsertableStreams
      ? { encodedInsertableStreams: true }
      : {},
  });

  recordLaneDiagnosticFn('voice', 'send_transport_created', {
    channelId: chId,
    purpose,
    transportId: transportOptions?.id || null,
    encodedInsertableStreams,
  });

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    emitAsyncFn('voice:connect-transport', {
      channelId: chId,
      transportId: transport.id,
      dtlsParameters,
    }).then(callback).catch(errback);
  });

  transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
    emitAsyncFn('voice:produce', {
      channelId: chId,
      transportId: transport.id,
      kind,
      rtpParameters,
      appData,
    }).then(({ producerId }) => callback({ id: producerId })).catch(errback);
  });

  return transport;
}

export function createClientVoiceRecvTransport({
  device,
  transportOptions = {},
  chId = null,
  emitAsyncFn = async () => ({}),
  recordLaneDiagnosticFn = () => {},
  voiceSafeMode = false,
  disableVoiceInsertableStreams = false,
  insertableStreamsSupported = false,
} = {}) {
  const encodedInsertableStreams = shouldEnableVoiceRecvInsertableStreams({
    voiceSafeMode,
    disableVoiceInsertableStreams,
    insertableStreamsSupported,
  });

  const transport = device.createRecvTransport({
    ...transportOptions,
    additionalSettings: encodedInsertableStreams
      ? { encodedInsertableStreams: true }
      : {},
  });

  recordLaneDiagnosticFn('voice', 'recv_transport_created', {
    channelId: chId,
    transportId: transportOptions?.id || null,
    encodedInsertableStreams,
  });

  transport.on('connect', ({ dtlsParameters }, callback, errback) => {
    emitAsyncFn('voice:connect-transport', {
      channelId: chId,
      transportId: transport.id,
      dtlsParameters,
    }).then(callback).catch(errback);
  });

  return transport;
}
