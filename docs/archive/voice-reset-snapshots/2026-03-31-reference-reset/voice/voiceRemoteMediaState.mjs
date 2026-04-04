export function listIncomingScreenShares(screenShareVideoEntries) {
  return Array.from(screenShareVideoEntries || []).map(([producerId, { userId, stream }]) => ({
    producerId,
    userId,
    stream,
  }));
}

export function setVoiceUserAudioEntry(userAudioMap, userId, producerId, audio) {
  let userAudioEntries = userAudioMap.get(userId);
  if (!userAudioEntries) {
    userAudioEntries = new Map();
    userAudioMap.set(userId, userAudioEntries);
  }
  userAudioEntries.set(producerId, audio);
}

export function removeVoiceUserAudioEntry(userAudioMap, userId, producerId) {
  const userAudioEntries = userAudioMap.get(userId);
  if (!userAudioEntries) return;
  userAudioEntries.delete(producerId);
  if (userAudioEntries.size === 0) {
    userAudioMap.delete(userId);
  }
}

export function removeVoiceConsumerDiagnostics(updateVoiceDiagnosticsFn, producerId) {
  updateVoiceDiagnosticsFn((previousDiagnostics) => {
    if (!previousDiagnostics.consumers[producerId]) return previousDiagnostics;
    const nextConsumers = { ...previousDiagnostics.consumers };
    delete nextConsumers[producerId];
    return {
      ...previousDiagnostics,
      consumers: nextConsumers,
    };
  });
}

export function cleanupRemoteVoiceProducer(producerId, {
  producerUserId = null,
  source = null,
  consumers = null,
  audioElements = null,
  userAudio = null,
  producerMeta = null,
  producerUserMap = null,
  screenShareVideos = null,
  clearVoicePlaybackHooksFn = () => {},
  syncIncomingScreenSharesFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
} = {}) {
  const consumer = consumers?.get?.(producerId) || null;
  if (consumer) {
    try { consumer.close(); } catch {}
    consumers.delete(producerId);
  }

  const storedProducerMeta = producerMeta?.get?.(producerId) || null;
  const ownerId = producerUserId || storedProducerMeta?.userId || producerUserMap?.get?.(producerId) || null;
  const producerSource = source || storedProducerMeta?.source || null;

  const audio = audioElements?.get?.(producerId) || null;
  if (audio) {
    clearVoicePlaybackHooksFn(audio);
    try { audio.pause?.(); } catch {}
    audio.srcObject = null;
    if (audio.parentNode) {
      audio.parentNode.removeChild(audio);
    }
    audioElements.delete(producerId);
  }

  if (ownerId) {
    removeVoiceUserAudioEntry(userAudio, ownerId, producerId);
  }

  if (producerSource === 'screen-video' || screenShareVideos?.has?.(producerId)) {
    screenShareVideos?.delete?.(producerId);
    syncIncomingScreenSharesFn();
  }

  producerMeta?.delete?.(producerId);
  producerUserMap?.delete?.(producerId);
  removeVoiceConsumerDiagnostics(updateVoiceDiagnosticsFn, producerId);
}
