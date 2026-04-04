import { useMemo } from 'react';

import { createVoiceUiActions } from './voiceUiActions.mjs';
import { buildVoiceUiActionContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceUiController({
  refs = {},
  setters = {},
  runtime = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceUiActions(buildVoiceUiActionContract({
    refs,
    setters,
    runtime,
  })), deps);
}
