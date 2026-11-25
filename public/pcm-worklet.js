const TARGET_RATE = 16000;
const CHUNK_SIZE = 1600; // 100ms at 16kHz

class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / TARGET_RATE;
    this.position = 0;
    this.chunk = new Int16Array(CHUNK_SIZE);
    this.filled = 0;
  }

  process([input]) {
    const samples = input[0];
    if (!samples) return true;

    for (; this.position < samples.length; this.position += this.step) {
      const value = Math.max(-1, Math.min(1, samples[Math.floor(this.position)]));
      this.chunk[this.filled++] = value * 0x7fff;

      if (this.filled === CHUNK_SIZE) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Int16Array(CHUNK_SIZE);
        this.filled = 0;
      }
    }
    this.position -= samples.length;
    return true;
  }
}

registerProcessor('pcm-capture', PcmCapture);
