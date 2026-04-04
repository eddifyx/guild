import { useState, useEffect, useCallback } from 'react';
import { normalizeVoiceInputDeviceId } from '../features/voice/voicePreferences.mjs';

function normalizeOutputSelection(deviceId) {
  const normalized = String(deviceId || '').trim();
  return normalized === 'default' ? '' : normalized;
}

export function useAudioDevices() {
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedInput, setSelectedInput] = useState(
    () => normalizeVoiceInputDeviceId(localStorage.getItem('voice:inputDeviceId') || '')
  );
  const [selectedOutput, setSelectedOutput] = useState(
    () => normalizeOutputSelection(localStorage.getItem('voice:outputDeviceId') || '')
  );

  const enumerate = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextInputDevices = devices.filter(d => d.kind === 'audioinput');
      const nextOutputDevices = devices.filter(d => d.kind === 'audiooutput');
      setInputDevices(nextInputDevices);
      setOutputDevices(nextOutputDevices);
      setSelectedInput((prev) => {
        const normalizedPrev = normalizeVoiceInputDeviceId(prev);
        if (!normalizedPrev || nextInputDevices.some((device) => device.deviceId === normalizedPrev)) {
          return normalizedPrev;
        }
        localStorage.setItem('voice:inputDeviceId', '');
        return '';
      });
      setSelectedOutput((prev) => {
        const normalizedPrev = normalizeOutputSelection(prev);
        if (!normalizedPrev || nextOutputDevices.some((device) => device.deviceId === normalizedPrev)) {
          return normalizedPrev;
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
    const normalizedDeviceId = normalizeVoiceInputDeviceId(deviceId);
    setSelectedInput(normalizedDeviceId);
    localStorage.setItem('voice:inputDeviceId', normalizedDeviceId);
  }, []);

  const selectOutput = useCallback((deviceId) => {
    const normalizedDeviceId = normalizeOutputSelection(deviceId);
    setSelectedOutput(normalizedDeviceId);
    localStorage.setItem('voice:outputDeviceId', normalizedDeviceId);
  }, []);

  return {
    inputDevices, outputDevices,
    selectedInput, selectedOutput,
    selectInput, selectOutput,
    refreshDevices: enumerate,
  };
}
