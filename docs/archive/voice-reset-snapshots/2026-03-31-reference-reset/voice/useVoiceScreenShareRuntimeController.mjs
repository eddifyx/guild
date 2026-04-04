import { useMemo } from 'react';

import { createVoiceScreenShareRuntimeBindings } from './voiceScreenShareRuntimeBindings.mjs';
import { buildVoiceScreenShareRuntimeBindingsContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceScreenShareRuntimeController({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceScreenShareRuntimeBindings(buildVoiceScreenShareRuntimeBindingsContract({
    refs,
    setters,
    runtime,
    constants,
  })), deps);
}
