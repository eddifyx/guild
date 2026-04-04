import { useVoiceRuntimeEffects } from './useVoiceRuntimeEffects.mjs';
import { buildUseVoiceRuntimeEffectsContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceRuntimeController({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  useVoiceRuntimeEffects(buildUseVoiceRuntimeEffectsContract({
    state,
    refs,
    runtime,
  }));
}
