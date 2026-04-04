import { useVoiceScreenShareController } from './useVoiceScreenShareController.mjs';

export function useVoiceScreenShareActionController({
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useVoiceScreenShareController({
    refs: {
      channelIdRef: refs.channelIdRef,
      participantIdsRef: refs.participantIdsRef,
      deviceRef: refs.deviceRef,
      screenShareStreamRef: refs.screenShareStreamRef,
      screenShareProducerRef: refs.screenShareProducerRef,
      screenShareAudioProducerRef: refs.screenShareAudioProducerRef,
      screenShareSimulcastEnabledRef: refs.screenShareSimulcastEnabledRef,
      stopScreenShareRef: refs.stopScreenShareRef,
    },
    runtime: {
      ...runtime,
      setShowSourcePickerFn: state.setShowSourcePicker,
      setScreenShareStreamFn: state.setScreenShareStream,
      setScreenShareDiagnosticsFn: state.setScreenShareDiagnostics,
      setVoiceE2EFn: state.setVoiceE2E,
      setE2EWarningFn: state.setE2EWarning,
      setScreenShareErrorFn: state.setScreenShareError,
      setScreenSharingFn: state.setScreenSharing,
    },
    constants,
    deps,
  });
}
