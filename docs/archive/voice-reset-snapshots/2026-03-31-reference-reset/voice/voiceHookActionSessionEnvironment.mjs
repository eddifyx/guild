import {
  playConnectChime,
  playLeaveChime,
} from '../../utils/chime.js';
import { rememberUsers } from '../../crypto/identityDirectory.js';
import { APPLE_VOICE_CAPTURE_OWNERS } from '../../utils/appleVoiceCapture.js';
import { cancelPerfTrace } from '../../utils/devPerf.js';
import { getDefaultVoiceControlState } from './voiceControlState.mjs';
import { getVoiceParticipantIds } from './voiceParticipantState.mjs';

const VOICE_SESSION_ERROR_TIMEOUT_MS = 8_000;

export function buildUseVoiceHookActionSessionEnvironment() {
  return {
    stopAppleVoiceCaptureFn: window.electronAPI?.stopAppleVoiceCapture,
    setTimeoutFn: window.setTimeout.bind(window),
    playLeaveChimeFn: playLeaveChime,
    clearTimeoutFn: clearTimeout,
    cancelPerfTraceFn: cancelPerfTrace,
    rememberUsersFn: rememberUsers,
    getVoiceParticipantIdsFn: getVoiceParticipantIds,
    playConnectChimeFn: playConnectChime,
    getPlatformFn: () => window.electronAPI?.getPlatform?.(),
    prefetchDesktopSourcesFn: () => window.electronAPI?.prefetchDesktopSources?.(),
    scheduleClearJoinErrorFn: (callback, delayMs) => setTimeout(callback, delayMs),
    logErrorFn: console.error,
    voiceSessionErrorTimeoutMs: VOICE_SESSION_ERROR_TIMEOUT_MS,
    appleVoiceCaptureOwner: APPLE_VOICE_CAPTURE_OWNERS.LIVE_VOICE,
    resetControlState: getDefaultVoiceControlState(),
  };
}
