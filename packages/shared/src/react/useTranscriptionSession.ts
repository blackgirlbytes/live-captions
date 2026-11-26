import { useSyncExternalStore } from "react";
import type { TranscriptionSession } from "../core/session";
import type { TranscriptState } from "../core/types";

/** Subscribe a component to a TranscriptionSession's state. */
export function useTranscriptionSession(session: TranscriptionSession): TranscriptState {
  return useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.getState(),
    () => session.getState(),
  );
}
