import {
  loadRnnoise,
  loadSpeex,
  NoiseGateWorkletNode,
  RnnoiseWorkletNode,
  SpeexWorkletNode,
} from '@sapphi-red/web-noise-suppressor';
import noiseGateWorkletPath from '@sapphi-red/web-noise-suppressor/noiseGateWorklet.js?url';
import rnnoiseWorkletPath from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url';
import rnnoiseWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmPath from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
import speexWorkletPath from '@sapphi-red/web-noise-suppressor/speexWorklet.js?url';
import speexWasmPath from '@sapphi-red/web-noise-suppressor/speex.wasm?url';

const registeredRnnoiseContexts = new WeakSet();
const registeredNoiseGateContexts = new WeakSet();
const registeredSpeexContexts = new WeakSet();
let wasmBinaryPromise = null;
let speexBinaryPromise = null;

async function getRnnoiseBinary() {
  if (!wasmBinaryPromise) {
    wasmBinaryPromise = loadRnnoise({
      url: rnnoiseWasmPath,
      simdUrl: rnnoiseSimdWasmPath,
    });
  }

  const wasmBinary = await wasmBinaryPromise;
  return wasmBinary.slice(0);
}

async function ensureRnnoiseWorklet(audioContext) {
  if (registeredRnnoiseContexts.has(audioContext)) {
    return;
  }

  await audioContext.audioWorklet.addModule(rnnoiseWorkletPath);
  registeredRnnoiseContexts.add(audioContext);
}

async function ensureNoiseGateWorklet(audioContext) {
  if (registeredNoiseGateContexts.has(audioContext)) {
    return;
  }

  await audioContext.audioWorklet.addModule(noiseGateWorkletPath);
  registeredNoiseGateContexts.add(audioContext);
}

async function getSpeexBinary() {
  if (!speexBinaryPromise) {
    speexBinaryPromise = loadSpeex({
      url: speexWasmPath,
    });
  }

  const wasmBinary = await speexBinaryPromise;
  return wasmBinary.slice(0);
}

async function ensureSpeexWorklet(audioContext) {
  if (registeredSpeexContexts.has(audioContext)) {
    return;
  }

  await audioContext.audioWorklet.addModule(speexWorkletPath);
  registeredSpeexContexts.add(audioContext);
}

export async function createRnnoiseNode(audioContext, { maxChannels = 1 } = {}) {
  await ensureRnnoiseWorklet(audioContext);
  const wasmBinary = await getRnnoiseBinary();

  return new RnnoiseWorkletNode(audioContext, {
    maxChannels,
    wasmBinary,
  });
}

export async function createNoiseGateNode(audioContext, {
  openThreshold = -42,
  closeThreshold = -52,
  holdMs = 120,
  maxChannels = 1,
} = {}) {
  await ensureNoiseGateWorklet(audioContext);

  return new NoiseGateWorkletNode(audioContext, {
    openThreshold,
    closeThreshold,
    holdMs,
    maxChannels,
  });
}

export async function createSpeexNode(audioContext, { maxChannels = 1 } = {}) {
  await ensureSpeexWorklet(audioContext);
  const wasmBinary = await getSpeexBinary();

  return new SpeexWorkletNode(audioContext, {
    maxChannels,
    wasmBinary,
  });
}
