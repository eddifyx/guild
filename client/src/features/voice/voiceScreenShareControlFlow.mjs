export function resolveVoiceScreenShareRequest({
  options = null,
  platform = null,
} = {}) {
  const sourceId = typeof options === 'string' ? options : options?.sourceId;
  const includeAudio = typeof options === 'string'
    ? platform !== 'darwin'
    : options?.includeAudio !== false;
  const macAudioDeviceId = typeof options === 'string' ? null : options?.macAudioDeviceId;

  return {
    sourceId,
    includeAudio,
    macAudioDeviceId,
  };
}

export async function confirmVoiceScreenShareSelection({
  options = null,
  refs = {},
  setShowSourcePickerFn = () => {},
  setScreenShareErrorFn = () => {},
  getPlatformFn = () => null,
  runVoiceScreenShareStartFlowFn = async () => {},
  buildStartPayloadFn = () => ({}),
} = {}) {
  setShowSourcePickerFn(false);
  setScreenShareErrorFn(null);
  if (!refs.channelIdRef?.current) {
    return null;
  }

  const request = resolveVoiceScreenShareRequest({
    options,
    platform: getPlatformFn(),
  });

  return runVoiceScreenShareStartFlowFn(buildStartPayloadFn(request));
}

export function buildVoiceScreenShareActionDeps({
  refs = {},
  runtime = {},
  constants = {},
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  consoleObject = globalThis.console,
} = {}) {
  return {
    channelIdRef: refs.channelIdRef,
    participantIdsRef: refs.participantIdsRef,
    deviceRef: refs.deviceRef,
    refs: refs.screenShareRefs || {},
    ensureSecureMediaReadyFn: runtime.ensureSecureMediaReadyFn,
    ensureVoiceKeyForParticipantsFn: runtime.ensureVoiceKeyForParticipantsFn,
    getOrCreateScreenSendTransportFn: runtime.getOrCreateScreenSendTransportFn,
    getRuntimeScreenShareCodecModeFn: runtime.getRuntimeScreenShareCodecModeFn,
    getPreferredScreenShareCodecCandidatesFn: runtime.getPreferredScreenShareCodecCandidatesFn,
    screenShareProfiles: constants.screenShareProfiles,
    initialProfileIndex: constants.initialProfileIndex,
    selectDesktopSourceFn: windowObject?.electronAPI?.selectDesktopSource,
    getDisplayMediaFn: (constraints) => navigatorObject.mediaDevices.getDisplayMedia(constraints),
    getUserMediaFn: (constraints) => navigatorObject.mediaDevices.getUserMedia(constraints),
    resetScreenShareAdaptationFn: runtime.resetScreenShareAdaptationFn,
    applyPreferredScreenShareConstraintsFn: runtime.applyPreferredScreenShareConstraintsFn,
    setScreenShareStreamFn: runtime.setScreenShareStreamFn,
    setScreenShareDiagnosticsFn: runtime.setScreenShareDiagnosticsFn,
    setVoiceE2EFn: runtime.setVoiceE2EFn,
    setE2EWarningFn: runtime.setE2EWarningFn,
    setScreenShareErrorFn: runtime.setScreenShareErrorFn,
    setScreenSharingFn: runtime.setScreenSharingFn,
    playStreamStartChimeFn: runtime.playStreamStartChimeFn,
    cleanupVoiceScreenShareSessionFn: runtime.cleanupVoiceScreenShareSessionFn,
    publishScreenShareVideoProducerFn: runtime.publishScreenShareVideoProducerFn,
    applySenderPreferencesFn: runtime.applySenderPreferencesFn,
    attachSenderEncryptionFn: runtime.attachSenderEncryptionFn,
    socket: runtime.socket,
    onVideoTrackEndedFn: runtime.onVideoTrackEndedFn,
    buildScreenShareStartErrorFn: runtime.buildScreenShareStartErrorFn,
    logScreenShareFailureContextFn: runtime.logScreenShareFailureContextFn,
    summarizeSelectedCodecFn: runtime.summarizeSelectedCodecFn,
    summarizeTrackSnapshotFn: runtime.summarizeTrackSnapshotFn,
    summarizeScreenShareProfileFn: runtime.summarizeScreenShareProfileFn,
    summarizeScreenShareHardwareFn: runtime.summarizeScreenShareHardwareFn,
    summarizeSenderParametersFn: runtime.summarizeSenderParametersFn,
    getScreenShareRequestedCaptureFn: runtime.getScreenShareRequestedCaptureFn,
    screenShareAudioMaxBitrate: constants.screenShareAudioMaxBitrate,
    warnFn: consoleObject.warn.bind(consoleObject),
  };
}

export async function runConfirmVoiceScreenShareAction({
  options = null,
  refs = {},
  deps = {},
  setShowSourcePickerFn = () => {},
  setScreenShareErrorFn = () => {},
  getPlatformFn = () => null,
  runVoiceScreenShareStartFlowFn = async () => {},
} = {}) {
  return confirmVoiceScreenShareSelection({
    options,
    refs,
    setShowSourcePickerFn,
    setScreenShareErrorFn,
    getPlatformFn,
    runVoiceScreenShareStartFlowFn,
    buildStartPayloadFn: (request) => buildVoiceScreenShareStartRequest({
      request,
      deps,
    }),
  });
}

export function buildVoiceScreenShareStartRequest({
  request = {},
  deps = {},
} = {}) {
  const {
    sourceId = null,
    includeAudio = true,
    macAudioDeviceId = null,
  } = request;

  return {
    channelId: deps.channelIdRef?.current,
    sourceId,
    includeAudio,
    macAudioDeviceId,
    participantIds: deps.participantIdsRef?.current || [],
    device: deps.deviceRef?.current || null,
    refs: deps.refs || {},
    ensureSecureMediaReadyFn: deps.ensureSecureMediaReadyFn,
    ensureVoiceKeyForParticipantsFn: deps.ensureVoiceKeyForParticipantsFn,
    getOrCreateScreenSendTransportFn: deps.getOrCreateScreenSendTransportFn,
    getRuntimeScreenShareCodecModeFn: deps.getRuntimeScreenShareCodecModeFn,
    getPreferredScreenShareCodecCandidatesFn: deps.getPreferredScreenShareCodecCandidatesFn,
    screenShareProfiles: deps.screenShareProfiles,
    initialProfileIndex: deps.initialProfileIndex,
    selectDesktopSourceFn: deps.selectDesktopSourceFn,
    getDisplayMediaFn: deps.getDisplayMediaFn,
    getUserMediaFn: deps.getUserMediaFn,
    resetScreenShareAdaptationFn: deps.resetScreenShareAdaptationFn,
    applyPreferredScreenShareConstraintsFn: deps.applyPreferredScreenShareConstraintsFn,
    setScreenShareStreamFn: deps.setScreenShareStreamFn,
    setScreenShareDiagnosticsFn: deps.setScreenShareDiagnosticsFn,
    setVoiceE2EFn: deps.setVoiceE2EFn,
    setE2EWarningFn: deps.setE2EWarningFn,
    setScreenShareErrorFn: deps.setScreenShareErrorFn,
    setScreenSharingFn: deps.setScreenSharingFn,
    playStreamStartChimeFn: deps.playStreamStartChimeFn,
    cleanupVoiceScreenShareSessionFn: deps.cleanupVoiceScreenShareSessionFn,
    publishScreenShareVideoProducerFn: deps.publishScreenShareVideoProducerFn,
    applySenderPreferencesFn: deps.applySenderPreferencesFn,
    attachSenderEncryptionFn: deps.attachSenderEncryptionFn,
    socket: deps.socket,
    onVideoTrackEndedFn: deps.onVideoTrackEndedFn,
    buildScreenShareStartErrorFn: deps.buildScreenShareStartErrorFn,
    logScreenShareFailureContextFn: deps.logScreenShareFailureContextFn,
    summarizeSelectedCodecFn: deps.summarizeSelectedCodecFn,
    summarizeTrackSnapshotFn: deps.summarizeTrackSnapshotFn,
    summarizeScreenShareProfileFn: deps.summarizeScreenShareProfileFn,
    summarizeScreenShareHardwareFn: deps.summarizeScreenShareHardwareFn,
    summarizeSenderParametersFn: deps.summarizeSenderParametersFn,
    getScreenShareRequestedCaptureFn: deps.getScreenShareRequestedCaptureFn,
    screenShareAudioMaxBitrate: deps.screenShareAudioMaxBitrate,
    warnFn: deps.warnFn,
  };
}

export function requestVoiceScreenShareStart({
  refs = {},
  setScreenShareErrorFn = () => {},
  setShowSourcePickerFn = () => {},
  ensureSecureMediaReadyFn = () => {},
} = {}) {
  setScreenShareErrorFn(null);
  ensureSecureMediaReadyFn('Screen sharing');
  if (!refs.channelIdRef?.current || !refs.deviceRef?.current) {
    throw new Error('Join a secure voice channel before starting screen share.');
  }

  setShowSourcePickerFn(true);
}

export function cancelVoiceScreenSharePicker({
  setShowSourcePickerFn = () => {},
  setScreenShareErrorFn = () => {},
} = {}) {
  setShowSourcePickerFn(false);
  setScreenShareErrorFn(null);
}

export function stopVoiceScreenShareSession({
  cleanupScreenShareSessionFn = () => {},
} = {}) {
  return cleanupScreenShareSessionFn({
    emitShareState: true,
    playStopChime: true,
    clearError: true,
  });
}

export function clearVoiceScreenShareError({
  setScreenShareErrorFn = () => {},
} = {}) {
  setScreenShareErrorFn(null);
}

export function createVoiceScreenShareActions({
  refs = {},
  runtime = {},
  constants = {},
  getPlatformFn = () => null,
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  consoleObject = globalThis.console,
  runVoiceScreenShareStartFlowFn = async () => {},
} = {}) {
  const deps = buildVoiceScreenShareActionDeps({
    refs,
    runtime,
    constants,
    windowObject,
    navigatorObject,
    consoleObject,
  });

  return {
    confirmScreenShare(options) {
      return runConfirmVoiceScreenShareAction({
        options,
        refs: {
          channelIdRef: refs.channelIdRef,
        },
        deps,
        setShowSourcePickerFn: runtime.setShowSourcePickerFn,
        setScreenShareErrorFn: runtime.setScreenShareErrorFn,
        getPlatformFn,
        runVoiceScreenShareStartFlowFn,
      });
    },
    startScreenShare() {
      return requestVoiceScreenShareStart({
        refs: {
          channelIdRef: refs.channelIdRef,
          deviceRef: refs.deviceRef,
        },
        setScreenShareErrorFn: runtime.setScreenShareErrorFn,
        setShowSourcePickerFn: runtime.setShowSourcePickerFn,
        ensureSecureMediaReadyFn: runtime.ensureSecureMediaReadyFn,
      });
    },
    cancelSourcePicker() {
      return cancelVoiceScreenSharePicker({
        setShowSourcePickerFn: runtime.setShowSourcePickerFn,
        setScreenShareErrorFn: runtime.setScreenShareErrorFn,
      });
    },
    stopScreenShare() {
      return stopVoiceScreenShareSession({
        cleanupScreenShareSessionFn: runtime.cleanupVoiceScreenShareSessionFn,
      });
    },
    clearScreenShareError() {
      return clearVoiceScreenShareError({
        setScreenShareErrorFn: runtime.setScreenShareErrorFn,
      });
    },
  };
}
