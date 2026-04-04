import { useCallback } from 'react';

export function useFollowingModalControllerSearchActions({
  state = {},
} = {}) {
  const {
    setQuery = () => {},
    setSearchMsg = () => {},
  } = state;

  const clearSearchMessage = useCallback((delayMs = 3000) => {
    setTimeout(() => setSearchMsg(''), delayMs);
  }, [setSearchMsg]);

  const handleSearchChange = useCallback((value) => {
    setQuery(value);
    setSearchMsg('');
  }, [setQuery, setSearchMsg]);

  return {
    clearSearchMessage,
    onSearchChange: handleSearchChange,
  };
}
