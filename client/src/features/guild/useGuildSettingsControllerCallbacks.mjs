import { useCallback } from 'react';

import { endPerfTraceAfterNextPaint, startPerfTrace } from '../../utils/devPerf';
import { selectGuildSettingsTab } from './guildSettingsDataFlow.mjs';
import { createGuildSettingsFlash } from './guildSettingsControllerRuntime.mjs';

export function useGuildSettingsControllerCallbacks({
  tab = 'Overview',
  setTabFn = () => {},
  startTabTransitionFn = (callback) => callback(),
  setErrorFn = () => {},
  setSuccessFn = () => {},
} = {}) {
  const flash = useCallback(createGuildSettingsFlash({
    setErrorFn,
    setSuccessFn,
    setTimeoutFn: window.setTimeout.bind(window),
  }), [setErrorFn, setSuccessFn]);

  const onSelectTab = useCallback((nextTab) => {
    selectGuildSettingsTab({
      currentTab: tab,
      nextTab,
      startPerfTraceFn: startPerfTrace,
      startTabTransitionFn,
      setTabFn,
      endPerfTraceAfterNextPaintFn: endPerfTraceAfterNextPaint,
    });
  }, [tab, startTabTransitionFn, setTabFn]);

  return {
    flash,
    onSelectTab,
  };
}
