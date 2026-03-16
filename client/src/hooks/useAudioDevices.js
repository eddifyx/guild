import { useState, useEffect, useCallback } from 'react';

export function useAudioDevices() {
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedInput, setSelectedInput] = useState(
    () => localStorage.getItem('voice:inputDeviceId') || ''
  );
  const [selectedOutput, setSelectedOutput] = useState(
    () => localStorage.getItem('voice:outputDeviceId') || ''
  );

  const enumerate = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextInputDevices = devices.filter(d => d.kind === 'audioinput');
      const nextOutputDevices = devices.filter(d => d.kind === 'audiooutput');
      setInputDevices(nextInputDevices);
      setOutputDevices(nextOutputDevices);
      setSelectedInput((prev) => {
        if (!prev || nextInputDevices.some((device) => device.deviceId === prev)) {
          return prev;
        }
        localStorage.setItem('voice:inputDeviceId', '');
        return '';
      });
      setSelectedOutput((prev) => {
        if (!prev || nextOutputDevices.some((device) => device.deviceId === prev)) {
          return prev;
        }
        localStorage.setItem('voice:outputDeviceId', '');
        return '';
      });
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
    }
  }, []);

  useEffect(() => {
    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, [enumerate]);

  const selectInput = useCallback((deviceId) => {
    setSelectedInput(deviceId);
    localStorage.setItem('voice:inputDeviceId', deviceId);
  }, []);

  const selectOutput = useCallback((deviceId) => {
    setSelectedOutput(deviceId);
    localStorage.setItem('voice:outputDeviceId', deviceId);
  }, []);

  return {
    inputDevices, outputDevices,
    selectedInput, selectedOutput,
    selectInput, selectOutput,
    refreshDevices: enumerate,
  };
}
