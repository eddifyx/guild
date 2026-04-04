import { useMemo, useRef } from 'react';

import {
  createVoiceHookScreenShareRuntimeBridge,
  createVoiceHookScreenShareRuntimeDeps,
  syncVoiceHookScreenShareRuntimeDeps,
} from './voiceHookScreenShareRuntimeBridge.mjs';

export function useVoiceHookScreenShareBridgeController() {
  const screenShareRuntimeDepsRef = useRef(createVoiceHookScreenShareRuntimeDeps());

  const deferredScreenShareRuntime = useMemo(() => (
    createVoiceHookScreenShareRuntimeBridge({ depsRef: screenShareRuntimeDepsRef })
  ), []);

  function syncScreenShareRuntimeDeps(deps) {
    return syncVoiceHookScreenShareRuntimeDeps(screenShareRuntimeDepsRef, deps);
  }

  return {
    screenShareRuntimeDepsRef,
    deferredScreenShareRuntime,
    syncScreenShareRuntimeDeps,
  };
}
