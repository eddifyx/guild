import { useMemo } from 'react';

import { createVoiceSessionActions } from './voiceSessionActions.mjs';
import { buildVoiceSessionActionContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceSessionController({
  socket = null,
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceSessionActions(buildVoiceSessionActionContract({
    socket,
    refs,
    setters,
    runtime,
    constants,
  })), deps);
}
