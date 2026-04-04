import { useMemo } from 'react';

import { createVoiceLiveCaptureBindings } from './voiceLiveCaptureBindings.mjs';
import { buildVoiceLiveCaptureBindingsContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceLiveCaptureBindingsController({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceLiveCaptureBindings(buildVoiceLiveCaptureBindingsContract({
    refs,
    setters,
    runtime,
    constants,
  })), deps);
}
