import { summarizeTrackSnapshot } from '../../utils/voiceDiagnostics.js';
import {
  attachReceiverDecryption,
  isInsertableStreamsSupported,
} from '../../crypto/voiceEncryption.js';
import {
  attachVoiceConsumerPlaybackRuntime,
  clearVoicePlaybackHooks,
} from './voiceConsumerPlayback.mjs';
import {
  cleanupRemoteVoiceProducer,
  listIncomingScreenShares,
  setVoiceUserAudioEntry,
} from './voiceRemoteMediaState.mjs';
import {
  createClientVoiceRecvTransport,
  createClientVoiceSendTransport,
} from './voiceClientTransportRuntime.mjs';
import { useVoiceTransportActionController } from './useVoiceTransportActionController.mjs';
import { useVoiceMediaActionController } from './useVoiceMediaActionController.mjs';
import {
  buildVoiceMediaActionControllerOptions,
  buildVoiceMediaActionRuntime,
  buildVoiceTransportActionRuntime,
  buildVoiceTransportActionControllerOptions,
} from './voiceHookBindings.mjs';
import {
  applyVoiceOutputDevice,
  readStoredUserVolume,
  readStoredVoiceOutputDeviceId,
} from './voicePreferences.mjs';
import {
  buildPlaybackErrorMessage,
  ensureVoiceAudioHost,
  getVoiceAudioBypassMode,
  roundMs,
} from './voiceRuntimeUtils.mjs';
import { VOICE_RECOVERY_RUNTIME } from './voiceRecoveryConfig.mjs';

const {
  voiceSafeMode: VOICE_SAFE_MODE,
  disableVoiceInsertableStreams: VOICE_RECOVERY_DISABLE_VOICE_INSERTABLE_STREAMS,
} = VOICE_RECOVERY_RUNTIME;

export function useVoiceHookMediaTransportControllerRuntime({
  socket = null,
  currentUserId = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  const {
    updateVoiceDiagnosticsFn = () => {},
    resetScreenShareAdaptationFn = () => {},
  } = runtime;

  const voiceMediaActions = useVoiceMediaActionController(
    buildVoiceMediaActionControllerOptions({
      refs,
      runtime: buildVoiceMediaActionRuntime({
        setIncomingScreenSharesFn: state.setIncomingScreenShares,
        listIncomingScreenSharesFn: listIncomingScreenShares,
        setVoiceUserAudioEntryFn: setVoiceUserAudioEntry,
        ensureVoiceAudioHostFn: ensureVoiceAudioHost,
        cleanupRemoteVoiceProducerFn: cleanupRemoteVoiceProducer,
        clearVoicePlaybackHooksFn: clearVoicePlaybackHooks,
        updateVoiceDiagnosticsFn,
      }),
      deps: [updateVoiceDiagnosticsFn],
    })
  );

  const {
    syncIncomingScreenShares,
    setUserAudioEntry,
    mountRemoteAudioElement,
    cleanupRemoteProducer,
  } = voiceMediaActions;

  const voiceTransportActions = useVoiceTransportActionController(
    buildVoiceTransportActionControllerOptions({
      currentUserId,
      refs,
      runtime: buildVoiceTransportActionRuntime({
        emitAsyncFn: runtime.emitAsyncFn,
        recordLaneDiagnosticFn: runtime.recordLaneDiagnosticFn,
        socket,
        resetScreenShareAdaptationFn,
        getCurrentChannelIdFn: () => refs.channelIdRef?.current,
        playStreamStopChimeFn: runtime.playStreamStopChimeFn,
        setScreenSharingFn: state.setScreenSharing,
        setScreenShareStreamFn: state.setScreenShareStream,
        setScreenShareErrorFn: state.setScreenShareError,
        setScreenShareDiagnosticsFn: state.setScreenShareDiagnostics,
        cleanupRemoteProducerFn: cleanupRemoteProducer,
        syncIncomingScreenSharesFn: syncIncomingScreenShares,
        updateVoiceDiagnosticsFn,
        getPrimaryCodecMimeTypeFromRtpParametersFn: runtime.getPrimaryCodecMimeTypeFromRtpParametersFn,
        getExperimentalScreenVideoBypassModeFn: runtime.getExperimentalScreenVideoBypassModeFn,
        getVoiceAudioBypassModeFn: (payload = {}) => (
          getVoiceAudioBypassMode({
            ...payload,
            disableVoiceInsertableStreams: VOICE_RECOVERY_DISABLE_VOICE_INSERTABLE_STREAMS,
          })
        ),
        attachReceiverDecryptionFn: attachReceiverDecryption,
        summarizeTrackSnapshotFn: summarizeTrackSnapshot,
        summarizeReceiverVideoCodecSupportFn: runtime.summarizeReceiverVideoCodecSupportFn,
        mountRemoteAudioElementFn: mountRemoteAudioElement,
        applyVoiceOutputDeviceFn: applyVoiceOutputDevice,
        readStoredVoiceOutputDeviceIdFn: readStoredVoiceOutputDeviceId,
        setUserAudioEntryFn: setUserAudioEntry,
        readStoredUserVolumeFn: readStoredUserVolume,
        attachVoiceConsumerPlaybackRuntimeFn: attachVoiceConsumerPlaybackRuntime,
        buildPlaybackErrorMessageFn: buildPlaybackErrorMessage,
        roundMsFn: roundMs,
        performanceNowFn: () => performance.now(),
        nowIsoFn: () => new Date().toISOString(),
        insertableStreamsSupported: isInsertableStreamsSupported(),
        createClientVoiceSendTransportFn: createClientVoiceSendTransport,
        createClientVoiceRecvTransportFn: createClientVoiceRecvTransport,
      }),
      constants: {
        voiceSafeMode: VOICE_SAFE_MODE,
        disableVoiceInsertableStreams: VOICE_RECOVERY_DISABLE_VOICE_INSERTABLE_STREAMS,
      },
      deps: [
        cleanupRemoteProducer,
        runtime.emitAsyncFn,
        mountRemoteAudioElement,
        resetScreenShareAdaptationFn,
        setUserAudioEntry,
        socket,
        syncIncomingScreenShares,
        updateVoiceDiagnosticsFn,
        currentUserId,
      ],
    })
  );

  return {
    syncIncomingScreenShares,
    setUserAudioEntry,
    mountRemoteAudioElement,
    cleanupRemoteProducer,
    createSendTransport: voiceTransportActions.createSendTransport,
    getOrCreateScreenSendTransport: voiceTransportActions.getOrCreateScreenSendTransport,
    cleanupScreenShareSession: voiceTransportActions.cleanupScreenShareSession,
    createRecvTransport: voiceTransportActions.createRecvTransport,
    consumeProducer: voiceTransportActions.consumeProducer,
  };
}
