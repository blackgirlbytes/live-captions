/**
 * Tab audio → 16 kHz mono linear16 PCM chunks, using an AudioWorklet.
 *
 * The worklet source is exported as a string so each surface can load it the way its
 * Content-Security-Policy allows: the web app uses a Blob URL (`createPcmWorkletUrl`),
 * the extension ships it as a packaged file (`chrome.runtime.getURL("pcm-worklet.js")`).
 */

export const PCM_TARGET_SAMPLE_RATE = 16000;
export const PCM_WORKLET_NAME = "earshot-pcm";

export const PCM_WORKLET_SOURCE = /* js */ `
class EarshotPcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.ratio = sampleRate / (o.targetSampleRate || 16000);
    this.pos = 0;
    this.prev = 0;
    this.size = o.chunkSamples || 1600;
    this.chunk = new Int16Array(this.size);
    this.idx = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) return true;
    const n = input[0].length;
    const channels = input.length;
    const mono = new Float32Array(n);
    for (let c = 0; c < channels; c++) {
      const data = input[c];
      for (let i = 0; i < n; i++) mono[i] += data[i] / channels;
    }
    // Linear-interpolation resampler; position carries across render quanta.
    while (this.pos < n - 1) {
      const i0 = Math.floor(this.pos);
      const f = this.pos - i0;
      const a = i0 < 0 ? this.prev : mono[i0];
      const b = mono[i0 + 1];
      let v = a + (b - a) * f;
      v = v < -1 ? -1 : v > 1 ? 1 : v;
      this.chunk[this.idx++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.idx === this.size) {
        this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
        this.chunk = new Int16Array(this.size);
        this.idx = 0;
      }
      this.pos += this.ratio;
    }
    this.pos -= n;
    this.prev = mono[n - 1];
    return true;
  }
}
registerProcessor("${PCM_WORKLET_NAME}", EarshotPcmProcessor);
`;

/** Blob URL for the worklet (works where CSP allows blob: scripts, e.g. the web app). */
export function createPcmWorkletUrl(): string {
  return URL.createObjectURL(new Blob([PCM_WORKLET_SOURCE], { type: "application/javascript" }));
}

export interface PcmCaptureOptions {
  stream: MediaStream;
  workletUrl: string;
  /** Route captured audio back to the speakers (needed for chrome.tabCapture, which mutes the tab). */
  preservePlayback?: boolean;
  /** Chunk length in ms. Deepgram recommends 20–250 ms. */
  chunkMs?: number;
  onChunk: (pcm: ArrayBuffer) => void;
  /** Called when the captured track ends (user clicked "Stop sharing", tab closed, ...). */
  onEnded?: () => void;
}

export interface PcmCapture {
  readonly sampleRate: number;
  stop(): Promise<void>;
}

export async function startPcmCapture(opts: PcmCaptureOptions): Promise<PcmCapture> {
  const track = opts.stream.getAudioTracks()[0];
  if (!track) throw new Error("The captured stream has no audio track. Make sure “Share tab audio” is enabled.");

  const ctx = new AudioContext({ latencyHint: "interactive" });
  try {
    await ctx.audioWorklet.addModule(opts.workletUrl);
  } catch (err) {
    await ctx.close();
    throw new Error(`Could not load the audio processor: ${(err as Error).message}`);
  }
  const source = ctx.createMediaStreamSource(opts.stream);
  const chunkSamples = Math.round((PCM_TARGET_SAMPLE_RATE * (opts.chunkMs ?? 100)) / 1000);
  const node = new AudioWorkletNode(ctx, PCM_WORKLET_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCountMode: "max",
    processorOptions: { targetSampleRate: PCM_TARGET_SAMPLE_RATE, chunkSamples },
  });
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => opts.onChunk(e.data);

  // Keep the worklet pulled by the graph without making it audible.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  source.connect(node);
  node.connect(sink);
  sink.connect(ctx.destination);
  if (opts.preservePlayback) source.connect(ctx.destination);

  const onEnded = () => opts.onEnded?.();
  track.addEventListener("ended", onEnded);
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);

  let stopped = false;
  return {
    sampleRate: PCM_TARGET_SAMPLE_RATE,
    async stop() {
      if (stopped) return;
      stopped = true;
      track.removeEventListener("ended", onEnded);
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
        sink.disconnect();
      } catch {
        /* already disconnected */
      }
      await ctx.close().catch(() => undefined);
    },
  };
}

/** Stop every track of a stream (releases the "sharing this tab" indicator). */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}
