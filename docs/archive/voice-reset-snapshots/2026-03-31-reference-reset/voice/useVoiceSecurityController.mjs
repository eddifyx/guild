import { useMemo } from 'react';

import { createVoiceSecurityActions } from './voiceSecurityActions.mjs';
import { buildVoiceSecurityActionContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceSecurityController({
  refs = {},
  setters = {},
  runtime = {},
  userId = null,
  constants = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceSecurityActions(buildVoiceSecurityActionContract({
    refs,
    setters,
    runtime,
    currentUserId: userId,
    constants,
  })), deps);
}
