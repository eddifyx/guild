import { useVoiceDiagnosticsEffects } from './useVoiceDiagnosticsEffects.mjs';
import { useVoiceEventRuntimeEffects } from './useVoiceEventRuntimeEffects.mjs';
import { useVoiceStateSyncEffects } from './useVoiceStateSyncEffects.mjs';

export function useVoiceRuntimeEffects({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  useVoiceStateSyncEffects({ state, refs });
  useVoiceEventRuntimeEffects({ refs, runtime });
  useVoiceDiagnosticsEffects({ state, refs, runtime });
}
