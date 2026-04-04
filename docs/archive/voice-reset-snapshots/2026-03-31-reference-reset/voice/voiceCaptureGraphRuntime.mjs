export async function startSafeModeVoiceCaptureGraph({
  capture,
  stream = null,
  getVoiceAudioContextOptionsFn = () => ({}),
  readStoredMicGainFn = () => 1,
  audioContextCtor = globalThis.AudioContext,
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
  onGraphUnavailable = () => {},
} = {}) {
  const audioGraphStart = nowFn();

  try {
    const micCtx = new audioContextCtor(getVoiceAudioContextOptionsFn());
    capture.micCtx = micCtx;
    if (micCtx.state === 'suspended') {
      await micCtx.resume().catch(() => {});
    }
    const micSource = micCtx.createMediaStreamSource(stream);
    const gainNode = micCtx.createGain();
    gainNode.gain.value = readStoredMicGainFn();
    capture.gainNode = gainNode;
    // Keep speaking detection aligned with the user-facing mic sensitivity path.
    capture.vadNode = gainNode;
    micSource.connect(gainNode);

    return {
      micCtx,
      micSource,
      gainNode,
      audioGraphSetupMs: roundMsFn(nowFn() - audioGraphStart),
      error: null,
    };
  } catch (error) {
    onGraphUnavailable(error);
    return {
      micCtx: capture?.micCtx || null,
      micSource: null,
      gainNode: capture?.gainNode || null,
      audioGraphSetupMs: roundMsFn(nowFn() - audioGraphStart),
      error,
    };
  }
}

export async function startProcessedVoiceCaptureGraph({
  capture,
  stream = null,
  getVoiceAudioContextOptionsFn = () => ({}),
  readStoredMicGainFn = () => 1,
  audioContextCtor = globalThis.AudioContext,
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
} = {}) {
  const audioGraphStart = nowFn();
  const micCtx = new audioContextCtor(getVoiceAudioContextOptionsFn());
  capture.micCtx = micCtx;
  if (micCtx.state === 'suspended') {
    await micCtx.resume().catch(() => {});
  }
  const micSource = micCtx.createMediaStreamSource(stream);
  const gainNode = micCtx.createGain();
  gainNode.gain.value = readStoredMicGainFn();
  capture.gainNode = gainNode;
  // Keep speaking detection aligned with the user-facing mic sensitivity path.
  capture.vadNode = gainNode;
  const destination = micCtx.createMediaStreamDestination();
  gainNode.connect(destination);

  return {
    micCtx,
    micSource,
    gainNode,
    destinationTrack: destination.stream.getAudioTracks()[0] || null,
    audioGraphSetupMs: roundMsFn(nowFn() - audioGraphStart),
  };
}
