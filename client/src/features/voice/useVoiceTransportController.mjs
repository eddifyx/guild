import { useMemo } from 'react';

import { createVoiceTransportActions } from './voiceTransportActions.mjs';
import { buildVoiceTransportActionContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceTransportController({
  refs = {},
  runtime = {},
  currentUserId = null,
  constants = {},
  deps = [],
} = {}) {
  return useMemo(() => createVoiceTransportActions(buildVoiceTransportActionContract({
    refs,
    runtime,
    constants,
    currentUserId,
  })), deps);
}
