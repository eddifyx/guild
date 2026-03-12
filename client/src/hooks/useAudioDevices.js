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
      setInputDevices(devices.filter(d => d.kind === 'audioinput'));
      setOutputDevices(devices.filter(d => d.kind === 'audiooutput'));
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
