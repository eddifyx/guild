import keyboardSuppressorWorkletPath from '../audio-worklets/keyboardSuppressor.worklet.js?url';

const KEYBOARD_SUPPRESSOR_ID = 'guild-keyboard-suppressor';
const registeredContexts = new WeakSet();

async function ensureKeyboardSuppressorWorklet(audioContext) {
  if (registeredContexts.has(audioContext)) {
    return;
  }

  await audioContext.audioWorklet.addModule(keyboardSuppressorWorkletPath);
  registeredContexts.add(audioContext);
}

export async function createKeyboardSuppressorNode(audioContext, { maxChannels = 1 } = {}) {
  await ensureKeyboardSuppressorWorklet(audioContext);

  return new AudioWorkletNode(audioContext, KEYBOARD_SUPPRESSOR_ID, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [maxChannels],
    processorOptions: {
      maxChannels,
    },
  });
}
