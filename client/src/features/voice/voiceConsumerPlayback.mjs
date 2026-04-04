import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';

export function updateVoiceConsumerPlayback(updateVoiceDiagnosticsFn, producerId, playback) {
  updateVoiceDiagnosticsFn((previousDiagnostics) => ({
    ...previousDiagnostics,
    consumers: {
      ...previousDiagnostics.consumers,
      [producerId]: {
        ...previousDiagnostics.consumers[producerId],
        playback,
      },
    },
  }));
}

export function clearVoicePlaybackHooks(audio) {
  try { audio?._voiceRetryCleanup?.(); } catch {}
  try { audio?._voiceMediaCleanup?.(); } catch {}
  if (audio) {
    delete audio._voiceRetryCleanup;
    delete audio._voiceMediaCleanup;
  }
}

export function attachVoiceConsumerPlaybackRuntime({
  audio,
  consumerTrack = null,
  chId = null,
  producerId = null,
  producerUserId = null,
  buildPlaybackErrorMessageFn = (error) => error?.message || error?.name || String(error),
  updateVoiceDiagnosticsFn = () => {},
  recordLaneDiagnosticFn = recordLaneDiagnostic,
  documentObject = globalThis.document,
  windowObject = globalThis.window,
} = {}) {
  const updatePlayback = (playback) => {
    updateVoiceConsumerPlayback(updateVoiceDiagnosticsFn, producerId, playback);
  };

  const attemptAudioPlayback = async ({ via = 'initial' } = {}) => {
    try {
      await audio.play();
      clearVoicePlaybackHooks(audio);
      recordLaneDiagnosticFn('voice', 'audio_playback_started', {
        channelId: chId,
        producerId,
        producerUserId,
        via,
      });
      updatePlayback({
        state: 'playing',
        via,
        startedAt: new Date().toISOString(),
        error: null,
      });
      return true;
    } catch (error) {
      const message = buildPlaybackErrorMessageFn(error);
      recordLaneDiagnosticFn('voice', 'audio_playback_blocked', {
        channelId: chId,
        producerId,
        producerUserId,
        via,
        error: message,
      });
      updatePlayback({
        state: 'blocked',
        via,
        startedAt: null,
        error: message,
      });
      return false;
    }
  };

  const retryOnMediaReady = () => {
    void attemptAudioPlayback({ via: 'media-ready' });
  };

  audio.addEventListener?.('loadedmetadata', retryOnMediaReady);
  audio.addEventListener?.('canplay', retryOnMediaReady);
  consumerTrack?.addEventListener?.('unmute', retryOnMediaReady);
  audio._voiceMediaCleanup = () => {
    audio.removeEventListener?.('loadedmetadata', retryOnMediaReady);
    audio.removeEventListener?.('canplay', retryOnMediaReady);
    consumerTrack?.removeEventListener?.('unmute', retryOnMediaReady);
  };

  void attemptAudioPlayback().then((started) => {
    if (started) return;

    const retry = () => {
      void attemptAudioPlayback({ via: 'user-gesture' });
    };
    const cleanup = () => {
      documentObject?.removeEventListener?.('click', retry);
      documentObject?.removeEventListener?.('keydown', retry);
      documentObject?.removeEventListener?.('pointerdown', retry);
      documentObject?.removeEventListener?.('visibilitychange', retry);
      windowObject?.removeEventListener?.('focus', retry);
    };

    audio._voiceRetryCleanup = cleanup;
    documentObject?.addEventListener?.('click', retry);
    documentObject?.addEventListener?.('keydown', retry);
    documentObject?.addEventListener?.('pointerdown', retry);
    documentObject?.addEventListener?.('visibilitychange', retry);
    windowObject?.addEventListener?.('focus', retry);
  });

  return {
    attemptAudioPlayback,
    clearPlaybackHooks: () => clearVoicePlaybackHooks(audio),
  };
}
