const {
  assignDesktopSourceCache,
  buildDesktopSourceThumbnails,
  createEmptyDesktopSourceCache,
  serializeDesktopSource,
} = require('./desktopSourceModel');

async function prefetchDesktopSources({
  platform,
  desktopCapturer,
  getCache,
  setCache,
  appendDebugLog,
  serializeDesktopSourceImpl = serializeDesktopSource,
  buildDesktopSourceThumbnailsImpl = buildDesktopSourceThumbnails,
  now = Date.now,
  warn = console.warn,
}) {
  if (platform !== 'darwin') return null;

  try {
    const screenSources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    });
    const cachedScreens = screenSources.map((source) =>
      serializeDesktopSourceImpl(source, { includeThumbnail: false })
    );
    assignDesktopSourceCache(getCache(), setCache, {
      ...createEmptyDesktopSourceCache(),
      sources: cachedScreens,
      time: now(),
    });

    const [windowSources, allSources] = await Promise.all([
      desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      }),
      desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      }),
    ]);
    const cachedWindows = windowSources.map((source) =>
      serializeDesktopSourceImpl(source, { includeThumbnail: true })
    );
    const thumbnails = buildDesktopSourceThumbnailsImpl(allSources);
    assignDesktopSourceCache(getCache(), setCache, {
      sources: cachedScreens,
      windows: cachedWindows,
      thumbnails,
      time: now(),
    });
    appendDebugLog(
      'desktop-source-prefetch',
      `screens=${cachedScreens.length} windows=${cachedWindows.length} thumbs=${Object.keys(thumbnails).length} windowPreviews=${cachedWindows.filter((source) => !!source.thumbnail).length}`
    );
    return { sources: cachedScreens, windows: cachedWindows, thumbnails };
  } catch (error) {
    warn('Desktop source prefetch failed:', error);
    return null;
  }
}

module.exports = {
  prefetchDesktopSources,
};
