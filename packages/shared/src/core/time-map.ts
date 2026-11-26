/**
 * Maps "stream time" (seconds of audio sent to Deepgram) to "media time"
 * (e.g. a video's currentTime) so transcript lines can link back into the video.
 *
 * A sample is recorded each time an audio chunk is sent. Because audio is only
 * streamed while media is playing, consecutive samples advance together.
 */
export class StreamTimeMap {
  private stream: number[] = [];
  private media: Array<number | null> = [];

  record(streamSeconds: number, mediaSeconds: number | null): void {
    const last = this.stream.length - 1;
    // Thin out samples that are perfectly predictable (steady playback) to keep memory flat.
    if (last >= 1 && mediaSeconds !== null) {
      const prevMedia = this.media[last];
      const prevPrevMedia = this.media[last - 1];
      if (
        prevMedia != null &&
        prevPrevMedia != null &&
        Math.abs(mediaSeconds - prevMedia - (streamSeconds - this.stream[last]!)) < 0.05 &&
        Math.abs(prevMedia - prevPrevMedia - (this.stream[last]! - this.stream[last - 1]!)) < 0.05 &&
        streamSeconds - this.stream[last - 1]! < 5
      ) {
        this.stream[last] = streamSeconds;
        this.media[last] = mediaSeconds;
        return;
      }
    }
    this.stream.push(streamSeconds);
    this.media.push(mediaSeconds);
  }

  /** Media time for a stream time, or null if unknown. */
  mediaAt(streamSeconds: number): number | null {
    const n = this.stream.length;
    if (n === 0) return null;
    // Find the first sample at/after t (samples mark chunk *ends*).
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.stream[mid]! < streamSeconds) lo = mid + 1;
      else hi = mid;
    }
    const s = this.stream[lo]!;
    const m = this.media[lo];
    if (m === null || m === undefined) return null;
    // Media advances 1:1 with stream within a chunk run.
    const value = m - (s - streamSeconds);
    return Math.max(0, value);
  }

  clear(): void {
    this.stream = [];
    this.media = [];
  }

  get size(): number {
    return this.stream.length;
  }
}
