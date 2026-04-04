import { getFollowingModalSearchPlan } from './followingModalRuntime.mjs';

export function startFollowingModalSearchRuntime({
  query,
  timerRef,
  setSearchResultsFn,
  setSearchingFn,
  setGuildNpubsFn,
  decodeNpubFn,
  fetchProfileFn,
  checkNpubsFn,
  searchProfilesFn,
  getSearchPlanFn = getFollowingModalSearchPlan,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  const searchPlan = getSearchPlanFn(query);
  if (searchPlan.mode === 'idle') {
    setSearchResultsFn([]);
    setSearchingFn(false);
    setGuildNpubsFn(new Set());
    return () => {};
  }

  setSearchingFn(true);
  clearTimeoutFn(timerRef.current);
  timerRef.current = setTimeoutFn(async () => {
    if (searchPlan.mode === 'npub') {
      try {
        const decoded = decodeNpubFn(searchPlan.query);
        const profile = await fetchProfileFn(decoded.data);
        setSearchResultsFn([{
          npub: searchPlan.query,
          name: profile?.name || null,
          picture: profile?.picture || null,
          about: '',
        }]);
      } catch {
        setSearchResultsFn([]);
      }

      try {
        const { registered } = await checkNpubsFn([searchPlan.query]);
        setGuildNpubsFn(new Set(registered));
      } catch {
        setGuildNpubsFn(new Set());
      }

      setSearchingFn(false);
      return;
    }

    let results = [];
    try {
      results = await searchProfilesFn(searchPlan.query);
      setSearchResultsFn(results);
    } catch {
      setSearchResultsFn([]);
    }

    if (results.length > 0) {
      try {
        const npubs = results.map((result) => result.npub);
        const { registered } = await checkNpubsFn(npubs);
        setGuildNpubsFn(new Set(registered));
      } catch {
        setGuildNpubsFn(new Set());
      }
    } else {
      setGuildNpubsFn(new Set());
    }

    setSearchingFn(false);
  }, searchPlan.delayMs);

  return () => clearTimeoutFn(timerRef.current);
}
