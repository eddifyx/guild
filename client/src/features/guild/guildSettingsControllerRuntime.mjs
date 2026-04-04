import { loadGuildSettingsResource } from './guildSettingsDataFlow.mjs';

export function createGuildSettingsResourceLoader({
  currentGuild = null,
  isLoaded = false,
  loadingRef = { current: {} },
  loadingKey = '',
  fetchFn = async () => null,
  commitFn = () => {},
  emptyValue = null,
  loadGuildSettingsResourceFn = loadGuildSettingsResource,
} = {}) {
  return async function loadResource({ force = false } = {}) {
    return loadGuildSettingsResourceFn({
      currentGuild,
      force,
      isLoaded,
      loadingRef,
      loadingKey,
      fetchFn,
      commitFn,
      emptyValue,
    });
  };
}

export function createGuildSettingsFlash({
  setErrorFn = () => {},
  setSuccessFn = () => {},
  setTimeoutFn = () => {},
  clearDelayMs = 3000,
} = {}) {
  return function flash(message, isError) {
    if (isError) {
      setErrorFn(message);
      setSuccessFn('');
    } else {
      setSuccessFn(message);
      setErrorFn('');
    }

    setTimeoutFn(() => {
      setErrorFn('');
      setSuccessFn('');
    }, clearDelayMs);
  };
}
