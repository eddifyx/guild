export function createVoiceMediaActions({
  refs = {},
  runtime = {},
} = {}) {
  function syncIncomingScreenShares() {
    runtime.setIncomingScreenSharesFn(
      runtime.listIncomingScreenSharesFn(refs.screenShareVideosRef.current.entries()),
    );
  }

  function setUserAudioEntry(userId, producerId, audio) {
    runtime.setVoiceUserAudioEntryFn(refs.userAudioRef.current, userId, producerId, audio);
  }

  function mountRemoteAudioElement(audio, producerId) {
    if (!audio) return;
    const host = runtime.ensureVoiceAudioHostFn();
    if (!host) return;
    if (audio.parentNode === host) return;

    audio.setAttribute('data-voice-producer-id', producerId);
    audio.style.display = 'none';
    host.appendChild(audio);
  }

  function cleanupRemoteProducer(producerId, { producerUserId = null, source = null } = {}) {
    runtime.cleanupRemoteVoiceProducerFn(producerId, {
      producerUserId,
      source,
      consumers: refs.consumersRef.current,
      audioElements: refs.audioElementsRef.current,
      userAudio: refs.userAudioRef.current,
      producerMeta: refs.producerMetaRef.current,
      producerUserMap: refs.producerUserMapRef.current,
      screenShareVideos: refs.screenShareVideosRef.current,
      clearVoicePlaybackHooksFn: runtime.clearVoicePlaybackHooksFn,
      syncIncomingScreenSharesFn: syncIncomingScreenShares,
      updateVoiceDiagnosticsFn: runtime.updateVoiceDiagnosticsFn,
    });
  }

  return {
    syncIncomingScreenShares,
    setUserAudioEntry,
    mountRemoteAudioElement,
    cleanupRemoteProducer,
  };
}
