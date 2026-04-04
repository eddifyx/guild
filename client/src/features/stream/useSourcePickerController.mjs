import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  buildSourcePickerSelectionPayload,
  splitDesktopSources,
} from './sourcePickerModel.mjs';
import {
  detectMacVirtualAudioDevicesRuntime,
  loadDesktopSourcesControllerRuntime,
} from './sourcePickerControllerRuntime.mjs';

const BLACKHOLE_URL = 'https://existential.audio/blackhole/';

export function useSourcePickerController({
  onSelect = () => {},
} = {}) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [virtualDevices, setVirtualDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [audioDetected, setAudioDetected] = useState(false);
  const thumbnailMapRef = useRef({});

  const isMac = window.electronAPI?.getPlatform?.() === 'darwin';

  useEffect(() => {
    if (isMac) {
      setIncludeAudio(false);
      setAudioDetected(false);
      detectMacVirtualAudioDevicesRuntime({
        enumerateDevicesFn: navigator.mediaDevices?.enumerateDevices?.bind(navigator.mediaDevices),
        setVirtualDevicesFn: setVirtualDevices,
        setSelectedAudioDeviceFn: setSelectedAudioDevice,
        setAudioDetectedFn: setAudioDetected,
        setIncludeAudioFn: setIncludeAudio,
      });
      return;
    }

    setIncludeAudio(true);
    setAudioDetected(true);
    setVirtualDevices([]);
    setSelectedAudioDevice('');
  }, [isMac]);

  useEffect(() => {
    loadDesktopSourcesControllerRuntime({
      isMac,
      getDesktopSourcesFn: window.electronAPI?.getDesktopSources,
      getDesktopWindowsFn: window.electronAPI?.getDesktopWindows,
      getDesktopThumbnailsFn: window.electronAPI?.getDesktopThumbnails,
      setSourcesFn: setSources,
      setLoadingFn: setLoading,
      thumbnailMapRef,
    });
  }, [isMac]);

  const { screens, windows } = useMemo(() => splitDesktopSources(sources), [sources]);

  const selectedAudioDeviceLabel = useMemo(() => (
    virtualDevices.find((device) => device.deviceId === selectedAudioDevice)?.label || 'virtual device'
  ), [selectedAudioDevice, virtualDevices]);

  const handleConfirm = useCallback(() => {
    const selection = buildSourcePickerSelectionPayload({
      selectedSourceId: selected,
      includeAudio,
      isMac,
      audioDetected,
      selectedAudioDevice,
    });
    if (!selection) return null;
    onSelect(selection);
    return selection;
  }, [audioDetected, includeAudio, isMac, onSelect, selected, selectedAudioDevice]);

  const openVirtualAudioInstaller = useCallback(() => {
    window.electronAPI?.openExternal?.(BLACKHOLE_URL);
  }, []);

  return {
    loading,
    selected,
    setSelected,
    screens,
    windows,
    isMac,
    includeAudio,
    setIncludeAudio,
    virtualDevices,
    selectedAudioDevice,
    setSelectedAudioDevice,
    selectedAudioDeviceLabel,
    audioDetected,
    handleConfirm,
    openVirtualAudioInstaller,
  };
}
