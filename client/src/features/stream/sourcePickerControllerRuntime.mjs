import {
  applyDesktopSourceThumbnails,
  mergeDesktopWindowSources,
  resolveMacVirtualAudioState,
} from './sourcePickerRuntime.mjs';

export async function detectMacVirtualAudioDevicesRuntime({
  enumerateDevicesFn = async () => [],
  resolveMacVirtualAudioStateFn = resolveMacVirtualAudioState,
  setVirtualDevicesFn = () => {},
  setSelectedAudioDeviceFn = () => {},
  setAudioDetectedFn = () => {},
  setIncludeAudioFn = () => {},
} = {}) {
  try {
    const devices = await enumerateDevicesFn();
    const nextAudioState = resolveMacVirtualAudioStateFn(devices);
    setVirtualDevicesFn(nextAudioState.virtualDevices);
    if (nextAudioState.audioDetected) {
      setSelectedAudioDeviceFn(nextAudioState.selectedAudioDevice);
      setAudioDetectedFn(true);
    } else {
      setIncludeAudioFn(false);
    }
    return nextAudioState;
  } catch {
    return null;
  }
}

export async function loadDesktopSourcesControllerRuntime({
  isMac = false,
  getDesktopSourcesFn = async () => [],
  getDesktopWindowsFn = async () => [],
  getDesktopThumbnailsFn = async () => null,
  mergeDesktopWindowSourcesFn = mergeDesktopWindowSources,
  applyDesktopSourceThumbnailsFn = applyDesktopSourceThumbnails,
  setSourcesFn = () => {},
  setLoadingFn = () => {},
  thumbnailMapRef = { current: {} },
} = {}) {
  try {
    const sources = await getDesktopSourcesFn();
    setSourcesFn(sources || []);
    setLoadingFn(false);

    if (!isMac) {
      return sources || [];
    }

    Promise.resolve(getDesktopWindowsFn()).then((windows) => {
      if (!windows?.length) return;
      setSourcesFn((currentSources) => mergeDesktopWindowSourcesFn({
        currentSources,
        windows,
        thumbnailMap: thumbnailMapRef.current,
      }));
    }).catch(() => {});

    Promise.resolve(getDesktopThumbnailsFn()).then((thumbnails) => {
      if (!thumbnails) return;
      setSourcesFn((currentSources) => {
        const nextSources = applyDesktopSourceThumbnailsFn({
          currentSources,
          thumbnails,
          thumbnailMap: thumbnailMapRef.current,
        });
        thumbnailMapRef.current = nextSources.thumbnailMap;
        return nextSources.sources;
      });
    }).catch(() => {});

    return sources || [];
  } catch {
    setLoadingFn(false);
    return null;
  }
}
