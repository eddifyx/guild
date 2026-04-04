export function startVoiceVadRuntime({
  currentVadIntervalId = null,
  clearIntervalFn = globalThis.clearInterval,
  setIntervalFn = globalThis.setInterval,
  analysisNode = null,
  gainNode = null,
  mutedRef = { current: false },
  channelIdRef = { current: null },
  socket = null,
  setSpeakingFn = () => {},
  uint8ArrayCtor = Uint8Array,
  intervalMs = 50,
  warmupFrames = 6,
  framesToActivate = 3,
  framesToDeactivate = 8,
  onError = () => {},
} = {}) {
  try {
    if (currentVadIntervalId) {
      clearIntervalFn(currentVadIntervalId);
    }
    const sourceNode = analysisNode || gainNode;
    if (!sourceNode?.context) {
      setSpeakingFn(false);
      return null;
    }

    const analyser = sourceNode.context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    sourceNode.connect(analyser);

    const frequencyData = new uint8ArrayCtor(analyser.frequencyBinCount);
    const timeDomainData = new uint8ArrayCtor(analyser.fftSize);
    let wasSpeaking = false;
    let speechFrames = 0;
    let silenceFrames = 0;
    let frameCount = 0;
    let rmsFloor = 0.012;
    let avgFloor = 3;
    let peakFloor = 10;

    return setIntervalFn(() => {
      if (mutedRef.current) {
        if (wasSpeaking) {
          wasSpeaking = false;
          speechFrames = 0;
          silenceFrames = 0;
          setSpeakingFn(false);
          if (channelIdRef.current && socket) {
            socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: false });
          }
        }
        return;
      }

      analyser.getByteFrequencyData(frequencyData);
      analyser.getByteTimeDomainData(timeDomainData);
      frameCount += 1;

      let avg = 0;
      const startBin = 1;
      let peak = 0;
      for (let index = startBin; index < frequencyData.length; index += 1) {
        const value = frequencyData[index];
        avg += value;
        if (value > peak) peak = value;
      }
      avg = frequencyData.length > startBin
        ? avg / (frequencyData.length - startBin)
        : 0;

      let sumSquares = 0;
      for (let index = 0; index < timeDomainData.length; index += 1) {
        const centered = (timeDomainData[index] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / Math.max(1, timeDomainData.length));

      const shouldAdaptNoiseFloor = frameCount <= warmupFrames || (
        !wasSpeaking
        && rms <= Math.max(0.018, rmsFloor * 1.35)
        && avg <= Math.max(4, avgFloor * 1.35)
        && peak <= Math.max(12, peakFloor * 1.35)
      );

      // Only let clearly quiet frames update the noise floor. Otherwise, normal
      // speech can get reclassified as the new baseline and never light up the
      // speaking indicator.
      if (shouldAdaptNoiseFloor) {
        rmsFloor = (rmsFloor * 0.9) + (rms * 0.1);
        avgFloor = (avgFloor * 0.9) + (avg * 0.1);
        peakFloor = (peakFloor * 0.9) + (peak * 0.1);
      }

      if (frameCount <= warmupFrames) {
        return;
      }

      const rmsThreshold = Math.max(0.024, rmsFloor * 3);
      const avgThreshold = Math.max(6, avgFloor * 2.2);
      const peakThreshold = Math.max(20, peakFloor * 1.9);
      const thresholdHits = Number(rms >= rmsThreshold)
        + Number(avg >= avgThreshold)
        + Number(peak >= peakThreshold);
      const strongRmsThreshold = Math.max(0.055, rmsFloor * 4.5);
      const aboveThreshold = thresholdHits >= 1
        || rms >= strongRmsThreshold;

      if (aboveThreshold) {
        speechFrames += 1;
        silenceFrames = 0;
      } else {
        silenceFrames += 1;
        speechFrames = 0;
      }

      let isSpeaking = wasSpeaking;
      if (!wasSpeaking && speechFrames >= framesToActivate) {
        isSpeaking = true;
      } else if (wasSpeaking && silenceFrames >= framesToDeactivate) {
        isSpeaking = false;
      }

      if (isSpeaking !== wasSpeaking) {
        wasSpeaking = isSpeaking;
        setSpeakingFn(isSpeaking);
        if (channelIdRef.current && socket) {
          socket.emit('voice:speaking', { channelId: channelIdRef.current, speaking: isSpeaking });
        }
      }
    }, intervalMs);
  } catch (error) {
    onError(error);
    return null;
  }
}
