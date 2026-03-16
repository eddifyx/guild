export function createSpeechFocusChain(audioContext) {
  const highPass = audioContext.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 95;
  highPass.Q.value = 0.707;

  const highShelf = audioContext.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 2400;
  highShelf.gain.value = -5.5;

  const lowPass = audioContext.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 4300;
  lowPass.Q.value = 0.707;

  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 8;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.12;

  highPass.connect(highShelf);
  highShelf.connect(lowPass);
  lowPass.connect(compressor);

  return {
    input: highPass,
    output: compressor,
    disconnect() {
      try { highPass.disconnect(); } catch {}
      try { highShelf.disconnect(); } catch {}
      try { lowPass.disconnect(); } catch {}
      try { compressor.disconnect(); } catch {}
    },
  };
}
