const KEYBOARD_SUPPRESSOR_ID = 'guild-keyboard-suppressor';

function createLowPassAlpha(sampleRate, cutoffHz) {
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  return dt / (rc + dt);
}

function createDecayCoefficient(sampleRate, seconds) {
  return Math.exp(-1 / (sampleRate * seconds));
}

class KeyboardSuppressorProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const maxChannels = Math.max(1, options?.processorOptions?.maxChannels || 1);
    this.channelStates = Array.from({ length: maxChannels }, () => ({
      lowBand: 0,
      highEnv: 0,
      speechEnv: 0,
      previousHighEnergy: 0,
      transientHoldSamples: 0,
      gain: 1,
    }));
    this.lowPassAlpha = createLowPassAlpha(sampleRate, 1380);
    this.highEnvDecay = createDecayCoefficient(sampleRate, 0.018);
    this.speechEnvDecay = createDecayCoefficient(sampleRate, 0.08);
    this.gainAttackDecay = createDecayCoefficient(sampleRate, 0.0012);
    this.gainReleaseDecay = createDecayCoefficient(sampleRate, 0.042);
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input?.length || !output?.length) {
      return true;
    }

    const channelCount = Math.min(input.length, output.length, this.channelStates.length);

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const inputChannel = input[channelIndex];
      const outputChannel = output[channelIndex];
      const state = this.channelStates[channelIndex];

      for (let sampleIndex = 0; sampleIndex < inputChannel.length; sampleIndex += 1) {
        const sample = inputChannel[sampleIndex] || 0;
        state.lowBand += this.lowPassAlpha * (sample - state.lowBand);
        const highBand = sample - state.lowBand;

        const highEnergy = Math.abs(highBand);
        const speechEnergy = Math.abs(state.lowBand);

        state.highEnv = Math.max(highEnergy, state.highEnv * this.highEnvDecay);
        state.speechEnv = Math.max(speechEnergy, state.speechEnv * this.speechEnvDecay);

        const keyboardRatio = state.highEnv / ((state.speechEnv * 1.05) + 0.00045);
        const transientRise = highEnergy - state.previousHighEnergy;
        const transientTrigger = (
          highEnergy > 0.0014
          && transientRise > 0.0009
          && keyboardRatio > 0.86
        );

        if (transientTrigger) {
          state.transientHoldSamples = Math.floor(sampleRate * (state.speechEnv < 0.012 ? 0.085 : 0.045));
        } else if (state.transientHoldSamples > 0) {
          state.transientHoldSamples -= 1;
        }

        let targetGain = 1;
        if (state.highEnv > 0.0016) {
          if (state.speechEnv < 0.012) {
            const excess = Math.max(0, keyboardRatio - 0.92);
            targetGain = Math.max(0.008, 1 - (excess * 1.08));
          } else {
            const excess = Math.max(0, keyboardRatio - 1.12);
            targetGain = Math.max(0.045, 1 - (excess * 0.86));
          }
        }

        if (state.transientHoldSamples > 0) {
          targetGain = Math.min(
            targetGain,
            state.speechEnv < 0.012 ? 0.003 : 0.028
          );
        }

        if (targetGain < state.gain) {
          state.gain = targetGain + (state.gain - targetGain) * this.gainAttackDecay;
        } else {
          state.gain = targetGain + (state.gain - targetGain) * this.gainReleaseDecay;
        }

        outputChannel[sampleIndex] = state.lowBand + (highBand * state.gain);
        state.previousHighEnergy = highEnergy;
      }
    }

    return true;
  }
}

registerProcessor(KEYBOARD_SUPPRESSOR_ID, KeyboardSuppressorProcessor);
