import {
  createClientVoiceRecvTransport,
  createClientVoiceSendTransport,
} from './voiceClientTransportRuntime.mjs';

function readVoiceTransportOptions(response) {
  if (!response || typeof response !== 'object' || !response.transportOptions || typeof response.transportOptions !== 'object') {
    throw new Error('Voice server did not return transport options.');
  }

  return response.transportOptions;
}

export async function createVoiceSendTransportSession({
  chId = null,
  purpose = 'voice',
  refs = {},
  emitAsyncFn = async () => ({}),
  recordLaneDiagnosticFn = () => {},
  voiceSafeMode = false,
  disableVoiceInsertableStreams = false,
  insertableStreamsSupported = false,
  createClientVoiceSendTransportFn = createClientVoiceSendTransport,
} = {}) {
  const transportOptions = readVoiceTransportOptions(await emitAsyncFn('voice:create-transport', {
    channelId: chId,
    direction: 'send',
    purpose,
  }));

  const transport = createClientVoiceSendTransportFn({
    device: refs.deviceRef?.current,
    transportOptions,
    chId,
    purpose,
    emitAsyncFn,
    recordLaneDiagnosticFn,
    voiceSafeMode,
    disableVoiceInsertableStreams,
    insertableStreamsSupported,
  });

  if (purpose === 'screen') {
    refs.screenSendTransportRef.current = transport;
  } else {
    refs.sendTransportRef.current = transport;
  }
  return transport;
}

export async function getOrCreateVoiceScreenSendTransport({
  chId = null,
  refs = {},
  createVoiceSendTransportSessionFn = createVoiceSendTransportSession,
} = {}) {
  const existingTransport = refs.screenSendTransportRef?.current;
  if (existingTransport && !existingTransport.closed) {
    return existingTransport;
  }

  return createVoiceSendTransportSessionFn({
    chId,
    purpose: 'screen',
    refs,
  });
}

export async function createVoiceRecvTransportSession({
  chId = null,
  refs = {},
  emitAsyncFn = async () => ({}),
  recordLaneDiagnosticFn = () => {},
  voiceSafeMode = false,
  disableVoiceInsertableStreams = false,
  insertableStreamsSupported = false,
  createClientVoiceRecvTransportFn = createClientVoiceRecvTransport,
} = {}) {
  const transportOptions = readVoiceTransportOptions(await emitAsyncFn('voice:create-transport', {
    channelId: chId,
    direction: 'recv',
  }));

  const transport = createClientVoiceRecvTransportFn({
    device: refs.deviceRef?.current,
    transportOptions,
    chId,
    emitAsyncFn,
    recordLaneDiagnosticFn,
    voiceSafeMode,
    disableVoiceInsertableStreams,
    insertableStreamsSupported,
  });

  refs.recvTransportRef.current = transport;
  return transport;
}
