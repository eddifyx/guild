class ApplePcmBridgeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.currentBuffer = null;
    this.currentIndex = 0;
    this.queuedSamples = 0;
    this.maxBufferedSamples = Math.floor(sampleRate * 0.12);

    this.port.onmessage = (event) => {
      const { data } = event;
      if (!data || typeof data !== 'object') {
        return;
      }

      if (data.type === 'reset') {
        this.queue.length = 0;
        this.currentBuffer = null;
        this.currentIndex = 0;
        this.queuedSamples = 0;
        return;
      }

      if (data.type !== 'push' || !(data.samples instanceof ArrayBuffer)) {
        return;
      }

      const int16 = new Int16Array(data.samples);
      const frame = new Float32Array(int16.length);
      for (let index = 0; index < int16.length; index += 1) {
        frame[index] = int16[index] / 32768;
      }
      this.queue.push(frame);
      this.queuedSamples += frame.length;

      while (this.queuedSamples > this.maxBufferedSamples && this.queue.length > 1) {
        const dropped = this.queue.shift();
        this.queuedSamples -= dropped?.length || 0;
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0]?.[0];
    if (!output) {
      return true;
    }

    for (let sampleIndex = 0; sampleIndex < output.length; sampleIndex += 1) {
      if (!this.currentBuffer || this.currentIndex >= this.currentBuffer.length) {
        this.currentBuffer = this.queue.shift() || null;
        this.currentIndex = 0;
        if (this.currentBuffer) {
          this.queuedSamples -= this.currentBuffer.length;
        }
      }

      if (!this.currentBuffer) {
        output[sampleIndex] = 0;
        continue;
      }

      output[sampleIndex] = this.currentBuffer[this.currentIndex];
      this.currentIndex += 1;
    }

    return true;
  }
}

registerProcessor('apple-pcm-bridge', ApplePcmBridgeProcessor);
