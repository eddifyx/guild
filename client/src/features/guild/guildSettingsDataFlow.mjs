export async function loadGuildSettingsResource({
  currentGuild = null,
  force = false,
  isLoaded = false,
  loadingRef = { current: {} },
  loadingKey = '',
  fetchFn = async () => null,
  commitFn = () => {},
  emptyValue = null,
} = {}) {
  if (!currentGuild) return emptyValue;
  if (!force && (isLoaded || loadingRef.current?.[loadingKey])) return emptyValue;

  loadingRef.current[loadingKey] = true;
  try {
    const nextValue = await fetchFn(currentGuild);
    commitFn(nextValue);
    return nextValue;
  } finally {
    loadingRef.current[loadingKey] = false;
  }
}

export function selectGuildSettingsTab({
  currentTab = null,
  nextTab = null,
  startPerfTraceFn = () => null,
  startTabTransitionFn = (callback) => callback(),
  setTabFn = () => {},
  endPerfTraceAfterNextPaintFn = () => {},
} = {}) {
  if (!nextTab || nextTab === currentTab) {
    return null;
  }

  const traceId = startPerfTraceFn('guild-settings-tab-switch', {
    fromTab: currentTab,
    toTab: nextTab,
    surface: 'guild-settings',
  });

  startTabTransitionFn(() => {
    setTabFn(nextTab);
  });

  endPerfTraceAfterNextPaintFn(traceId, {
    status: 'ready',
    surface: 'guild-settings',
    tab: nextTab,
  });

  return traceId;
}
