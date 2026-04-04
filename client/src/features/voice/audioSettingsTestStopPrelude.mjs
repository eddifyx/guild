export function applyAudioSettingsTestStopPrelude({
  testRunIdRef = { current: 0 },
  animFrameRef = { current: null },
  cancelAnimationFrameFn = globalThis.cancelAnimationFrame,
  setTestStartingFn = () => {},
} = {}) {
  testRunIdRef.current += 1;
  setTestStartingFn(false);

  if (animFrameRef.current) {
    cancelAnimationFrameFn?.(animFrameRef.current);
    animFrameRef.current = null;
  }
}
