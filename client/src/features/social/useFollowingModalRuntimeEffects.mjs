import { useEffect } from 'react';

export function useFollowingModalRuntimeEffects({
  selectedNpub = null,
  clearSelectedNpub = () => {},
  onClose = null,
  loadFriends = async () => {},
  loadRequests = async () => {},
  loadSentRequests = async () => {},
  socket = null,
  bindSocketRuntime = () => () => {},
  query = '',
  startSearchRuntime = () => () => {},
} = {}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (selectedNpub) {
        clearSelectedNpub();
        return;
      }
      onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelectedNpub, onClose, selectedNpub]);

  useEffect(() => {
    let cancelled = false;
    void loadFriends({ isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadFriends]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    void loadSentRequests();
  }, [loadSentRequests]);

  useEffect(() => bindSocketRuntime({ socket }), [bindSocketRuntime, socket]);

  useEffect(() => startSearchRuntime({ query }), [query, startSearchRuntime]);
}
