function createCachedAsyncLoader(loadValue) {
  let valuePromise = null;

  return function getCachedValue() {
    if (!valuePromise) {
      valuePromise = Promise.resolve().then(loadValue);
    }
    return valuePromise;
  };
}

module.exports = {
  createCachedAsyncLoader,
};
