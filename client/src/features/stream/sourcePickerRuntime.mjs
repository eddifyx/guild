import { detectVirtualAudioDevices } from './sourcePickerModel.mjs';

export function resolveMacVirtualAudioState(devices = []) {
  const virtualDevices = detectVirtualAudioDevices(devices);
  return {
    virtualDevices,
    selectedAudioDevice: virtualDevices[0]?.deviceId || '',
    audioDetected: virtualDevices.length > 0,
  };
}

export function mergeDesktopWindowSources({
  currentSources = [],
  windows = [],
  thumbnailMap = {},
} = {}) {
  const existingIds = new Set(currentSources.map((source) => source.id));
  const mergedWindows = windows
    .filter((source) => !existingIds.has(source.id))
    .map((source) => ({
      ...source,
      thumbnail: thumbnailMap[source.id] || source.thumbnail || null,
    }));

  return mergedWindows.length > 0
    ? [...currentSources, ...mergedWindows]
    : currentSources;
}

export function applyDesktopSourceThumbnails({
  currentSources = [],
  thumbnails = null,
  thumbnailMap = {},
} = {}) {
  if (!thumbnails) {
    return {
      sources: currentSources,
      thumbnailMap,
    };
  }

  const nextThumbnailMap = {
    ...thumbnailMap,
    ...thumbnails,
  };

  return {
    thumbnailMap: nextThumbnailMap,
    sources: currentSources.map((source) => ({
      ...source,
      thumbnail: nextThumbnailMap[source.id] || source.thumbnail || null,
    })),
  };
}
