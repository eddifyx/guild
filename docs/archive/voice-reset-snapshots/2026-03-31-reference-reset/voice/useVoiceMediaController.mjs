import { useMemo } from 'react';

import { createVoiceMediaActions } from './voiceMediaActions.mjs';
import { buildVoiceMediaActionContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceMediaController({
  refs = {},
  runtime = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceMediaActions(buildVoiceMediaActionContract({
    refs,
    runtime,
  })), deps);
}
