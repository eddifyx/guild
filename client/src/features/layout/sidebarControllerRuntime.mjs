export function readSidebarMutePreference({
  storage = globalThis.localStorage,
  key = '',
} = {}) {
  return storage?.getItem?.(key) === 'true';
}

export function toggleSidebarMutePreference({
  currentValue = false,
  storage = globalThis.localStorage,
  key = '',
} = {}) {
  const nextValue = !currentValue;
  storage?.setItem?.(key, String(nextValue));
  return nextValue;
}

export function openSidebarTracedModal({
  traceName = '',
  surface = 'sidebar',
  startPerfTraceFn = () => null,
  setOpenTraceIdFn = () => {},
  setVisibleFn = () => {},
} = {}) {
  const traceId = startPerfTraceFn(traceName, { surface });
  setOpenTraceIdFn(traceId);
  setVisibleFn(true);
  return traceId;
}

export function closeSidebarTracedModal({
  setVisibleFn = () => {},
  setOpenTraceIdFn = () => {},
} = {}) {
  setVisibleFn(false);
  setOpenTraceIdFn(null);
}
