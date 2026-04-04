function shouldUseMemoryProtocolStoreFallback(error, { platform = process.platform } = {}) {
  if (platform !== 'win32') return false;
  const details = `${error?.message || ''}\n${error?.stack || ''}`;
  return /better-sqlite3|better_sqlite3\.node|bindings/i.test(details);
}

async function createProtocolStoreWithFallback({
  createPrimaryStore,
  createFallbackStore,
  shouldFallback = shouldUseMemoryProtocolStoreFallback,
  onFallback = () => {},
}) {
  try {
    return await createPrimaryStore();
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error;
    }

    onFallback(error);
    return createFallbackStore();
  }
}

module.exports = {
  createProtocolStoreWithFallback,
  shouldUseMemoryProtocolStoreFallback,
};
