function createEmptyDesktopSourceCache() {
  return { sources: null, windows: null, thumbnails: null, time: 0 };
}

function nativeImageToDataUrl(image) {
  try {
    if (!image || image.isEmpty?.()) return null;
    const dataUrl = image.toDataURL?.();
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return null;
    }

    const payload = dataUrl.split(',', 2)[1] || '';
    return payload.trim().length >= 32 ? dataUrl : null;
  } catch {
    return null;
  }
}

function serializeDesktopSource(
  source,
  {
    includeThumbnail = true,
    nativeImageToDataUrlImpl = nativeImageToDataUrl,
  } = {}
) {
  return {
    id: source.id,
    name: source.name,
    thumbnail: includeThumbnail ? nativeImageToDataUrlImpl(source.thumbnail) : null,
    icon: nativeImageToDataUrlImpl(source.appIcon),
  };
}

function buildDesktopSourceThumbnails(sources, { nativeImageToDataUrlImpl = nativeImageToDataUrl } = {}) {
  const thumbnails = {};
  for (const source of sources) {
    const thumbnail = nativeImageToDataUrlImpl(source.thumbnail);
    if (thumbnail) {
      thumbnails[source.id] = thumbnail;
    }
  }
  return thumbnails;
}

function assignDesktopSourceCache(currentCache, setCache, nextCache) {
  const resolved = typeof nextCache === 'function' ? nextCache(currentCache) : nextCache;
  setCache(resolved);
  return resolved;
}

module.exports = {
  assignDesktopSourceCache,
  buildDesktopSourceThumbnails,
  createEmptyDesktopSourceCache,
  nativeImageToDataUrl,
  serializeDesktopSource,
};
