const {
  assignDesktopSourceCache,
  buildDesktopSourceThumbnails,
  createEmptyDesktopSourceCache,
  serializeDesktopSource,
} = require('./desktopSourceModel');
const { prefetchDesktopSources } = require('./desktopSourcePrefetchRuntime');

async function getDesktopSources({
  platform,
  desktopCapturer,
  setCache,
  serializeDesktopSourceImpl = serializeDesktopSource,
  now = Date.now,
}) {
  setCache(createEmptyDesktopSourceCache());
  const isMac = platform === 'darwin';
  const sources = await desktopCapturer.getSources({
    types: isMac ? ['screen'] : ['screen', 'window'],
    thumbnailSize: isMac ? { width: 0, height: 0 } : { width: 320, height: 180 },
    fetchWindowIcons: !isMac,
  });
  const result = sources.map((source) =>
    serializeDesktopSourceImpl(source, { includeThumbnail: !isMac })
  );

  if (isMac) {
    setCache({
      ...createEmptyDesktopSourceCache(),
      sources: result,
      time: now(),
    });
  }

  return result;
}

async function getDesktopWindows({
  desktopCapturer,
  getCache,
  setCache,
  appendDebugLog,
  serializeDesktopSourceImpl = serializeDesktopSource,
  now = Date.now,
}) {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });
  const result = sources.map((source) =>
    serializeDesktopSourceImpl(source, { includeThumbnail: true })
  );
  assignDesktopSourceCache(getCache(), setCache, {
    ...getCache(),
    windows: result,
    time: now(),
  });
  appendDebugLog(
    'desktop-window-sources',
    `count=${result.length} previews=${result.filter((source) => !!source.thumbnail).length}`
  );
  return result;
}

async function getDesktopThumbnails({
  desktopCapturer,
  getCache,
  setCache,
  appendDebugLog,
  buildDesktopSourceThumbnailsImpl = buildDesktopSourceThumbnails,
  now = Date.now,
}) {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });
  const thumbnails = buildDesktopSourceThumbnailsImpl(sources);
  assignDesktopSourceCache(getCache(), setCache, {
    ...getCache(),
    thumbnails,
    time: now(),
  });
  appendDebugLog('desktop-thumbnails', `valid=${Object.keys(thumbnails).length} total=${sources.length}`);
  return thumbnails;
}

module.exports = {
  getDesktopSources,
  getDesktopThumbnails,
  getDesktopWindows,
  prefetchDesktopSources,
};
