import { rememberUsers } from '../../crypto/identityDirectory.js';
import {
  isVoiceDiagnosticsEnabled,
  summarizeConsumerStats,
  summarizeProducerStats,
  summarizeTrackSnapshot,
} from '../../utils/voiceDiagnostics.js';
import { prefersAppleSystemVoiceIsolation } from '../../utils/voiceProcessing.js';
import { getBitrateBps } from './screenShareAdaptation.mjs';
import {
  SCREEN_SHARE_PROFILES,
  summarizeScreenShareHardware,
  summarizeScreenShareProfile,
} from './screenShareProfile.mjs';

export function buildUseVoiceHookActionRuntimeEffectsEnvironment() {
  return {
    rememberUsersFn: rememberUsers,
    prefersAppleSystemVoiceIsolationFn: prefersAppleSystemVoiceIsolation,
    electronAPI: window.electronAPI,
    summarizeProducerStatsFn: summarizeProducerStats,
    summarizeConsumerStatsFn: summarizeConsumerStats,
    isVoiceDiagnosticsEnabledFn: isVoiceDiagnosticsEnabled,
    getBitrateBpsFn: getBitrateBps,
    summarizeTrackSnapshotFn: summarizeTrackSnapshot,
    summarizeScreenShareProfileFn: summarizeScreenShareProfile,
    summarizeScreenShareHardwareFn: summarizeScreenShareHardware,
    screenShareProfiles: SCREEN_SHARE_PROFILES,
    clearTimeoutFn: clearTimeout,
  };
}
