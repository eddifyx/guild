import { useEffect } from 'react';

export function useVoiceStateSyncEffects({
  state = {},
  refs = {},
} = {}) {
  const {
    voiceProcessingMode = null,
    channelId = null,
    muted = false,
    deafened = false,
  } = state;

  const {
    voiceProcessingModeRef = { current: null },
    channelIdRef = { current: null },
    mutedRef = { current: false },
    deafenedRef = { current: false },
  } = refs;

  useEffect(() => {
    voiceProcessingModeRef.current = voiceProcessingMode;
  }, [voiceProcessingMode, voiceProcessingModeRef]);

  useEffect(() => {
    channelIdRef.current = channelId;
  }, [channelId, channelIdRef]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted, mutedRef]);

  useEffect(() => {
    deafenedRef.current = deafened;
  }, [deafened, deafenedRef]);
}
