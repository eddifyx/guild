export function createTrustContactAction({
  effectiveConversation,
  trustInput,
  setTrustSavingFn,
  setTrustErrorFn,
  setTrustedNpubFn,
  setTrustInputFn,
  lookupUserByNpubFn,
  trustUserNpubFn,
} = {}) {
  return async function handleTrustContact() {
    if (!effectiveConversation || effectiveConversation.type !== 'dm' || effectiveConversation.dmUnsupported) {
      return false;
    }

    const npub = trustInput.trim();
    if (!npub.startsWith('npub1')) {
      setTrustErrorFn?.('Enter a valid npub to save this contact\'s Nostr identity.');
      return false;
    }

    setTrustSavingFn?.(true);
    setTrustErrorFn?.('');
    try {
      const userRecord = await lookupUserByNpubFn(npub);
      if (!userRecord) {
        throw new Error('That npub is not registered on this server.');
      }
      if (userRecord.id !== effectiveConversation.id) {
        throw new Error('That npub belongs to a different account than this DM.');
      }
      if (!trustUserNpubFn(effectiveConversation.id, npub)) {
        throw new Error('This contact already has a different trusted npub pinned.');
      }
      setTrustedNpubFn?.(npub);
      setTrustInputFn?.(npub);
      return true;
    } catch (err) {
      setTrustErrorFn?.(err?.message || 'Failed to trust this contact.');
      return false;
    } finally {
      setTrustSavingFn?.(false);
    }
  };
}
