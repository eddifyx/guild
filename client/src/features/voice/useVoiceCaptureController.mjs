import { useMemo } from 'react';

import { createVoiceCaptureActions } from './voiceCaptureActions.mjs';
import { buildVoiceCaptureActionContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceCaptureController({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceCaptureActions(buildVoiceCaptureActionContract({
    refs,
    setters,
    runtime,
    constants,
  })), deps);
}
