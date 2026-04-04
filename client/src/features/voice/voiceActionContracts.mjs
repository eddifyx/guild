import {
  buildVoiceSessionActionOptions,
  buildVoiceUiActionOptions,
} from './voiceControllerBindings.mjs';

export function buildVoiceTransportActionContract({
  refs = {},
  runtime = {},
  constants = {},
  currentUserId = null,
} = {}) {
  return {
    refs: {
      deviceRef: refs.deviceRef,
      sendTransportRef: refs.sendTransportRef,
      screenSendTransportRef: refs.screenSendTransportRef,
      screenShareAudioProducerRef: refs.screenShareAudioProducerRef,
      screenShareProducerRef: refs.screenShareProducerRef,
      screenShareStreamRef: refs.screenShareStreamRef,
      screenShareStatsRef: refs.screenShareStatsRef,
      recvTransportRef: refs.recvTransportRef,
      consumersRef: refs.consumersRef,
      producerUserMapRef: refs.producerUserMapRef,
      producerMetaRef: refs.producerMetaRef,
      screenShareVideosRef: refs.screenShareVideosRef,
      audioElementsRef: refs.audioElementsRef,
      deafenedRef: refs.deafenedRef,
    },
    runtime,
    constants,
    currentUserId,
  };
}

export function buildVoiceMediaActionContract({
  refs = {},
  runtime = {},
} = {}) {
  return {
    refs,
    runtime,
  };
}

export function buildVoiceSecurityActionContract({
  refs = {},
  setters = {},
  runtime = {},
  currentUserId = null,
  constants = {},
} = {}) {
  return {
    refs,
    setters,
    runtime,
    currentUserId,
    constants,
  };
}

export function buildVoiceCaptureActionContract({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
} = {}) {
  return {
    refs,
    setters,
    runtime,
    constants,
  };
}

export function buildVoiceScreenShareRuntimeBindingsContract({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
} = {}) {
  return {
    refs,
    setters,
    runtime,
    constants,
  };
}

export function buildVoiceLiveCaptureBindingsContract({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
} = {}) {
  return {
    refs,
    setters,
    runtime,
    constants,
  };
}

export function buildVoiceSessionActionContract({
  socket = null,
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
} = {}) {
  return buildVoiceSessionActionOptions({
    socket,
    refs,
    setters,
    runtime,
    constants,
  });
}

export function buildVoiceUiActionContract({
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  return buildVoiceUiActionOptions({
    refs,
    setters,
    runtime,
  });
}
