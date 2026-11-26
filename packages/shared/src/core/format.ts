import type { TranscriptLine } from "./types";

/** 75.4 → "1:15", 3725 → "1:02:05". */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function clock(seconds: number, msSeparator: "," | "."): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${msSeparator}${String(ms).padStart(3, "0")}`;
}

export type TimeBase = "media" | "stream";

/** Media time when every line has it (seekable source), otherwise time since capture start. */
export function preferredTimeBase(lines: TranscriptLine[]): TimeBase {
  return lines.length > 0 && lines.every((l) => l.mediaStart !== null) ? "media" : "stream";
}

export function lineTimes(line: TranscriptLine, base: TimeBase): { start: number; end: number } {
  if (base === "media" && line.mediaStart !== null) {
    return { start: line.mediaStart, end: line.mediaEnd ?? line.mediaStart + (line.end - line.start) };
  }
  return { start: line.start, end: line.end };
}

export function toPlainText(lines: TranscriptLine[], opts: { timestamps?: boolean; base?: TimeBase } = {}): string {
  const base = opts.base ?? preferredTimeBase(lines);
  return lines
    .map((l) => (opts.timestamps === false ? l.text : `[${formatTimestamp(lineTimes(l, base).start)}] ${l.text}`))
    .join("\n");
}

export function toSrt(lines: TranscriptLine[], base: TimeBase = preferredTimeBase(lines)): string {
  return lines
    .map((l, i) => {
      const t = lineTimes(l, base);
      return `${i + 1}\n${clock(t.start, ",")} --> ${clock(Math.max(t.end, t.start + 0.5), ",")}\n${l.text}\n`;
    })
    .join("\n");
}

export function toVtt(lines: TranscriptLine[], base: TimeBase = preferredTimeBase(lines)): string {
  const cues = lines.map((l) => {
    const t = lineTimes(l, base);
    return `${clock(t.start, ".")} --> ${clock(Math.max(t.end, t.start + 0.5), ".")}\n${l.text}\n`;
  });
  return `WEBVTT\n\n${cues.join("\n")}`;
}

export type ExportFormat = "txt" | "srt" | "vtt";

export function exportTranscript(lines: TranscriptLine[], format: ExportFormat): { content: string; mime: string } {
  switch (format) {
    case "srt":
      return { content: toSrt(lines), mime: "application/x-subrip" };
    case "vtt":
      return { content: toVtt(lines), mime: "text/vtt" };
    default:
      return { content: toPlainText(lines), mime: "text/plain" };
  }
}

/** Browser-only helper: trigger a file download. */
export function downloadTranscript(lines: TranscriptLine[], format: ExportFormat, baseName = "transcript"): void {
  const { content, mime } = exportTranscript(lines, format);
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFileName(baseName)}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "transcript";
}
