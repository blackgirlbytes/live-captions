"use client";

import { useState } from "react";
import { DeepgramKeyForm } from "./DeepgramKeyForm";
import { forgetUserKey, keyMode, maskKey } from "@/lib/deepgram-key";
import { useT } from "@/i18n/I18nProvider";

export interface DeepgramKeySettingsProps {
  userKey: string | null;
  /** Whether the Heard server has its own key (null = unknown). */
  serverKey: boolean | null;
  /** Start with the add/replace form open (e.g. after Deepgram rejected the key). */
  initiallyEditing?: boolean;
  /** Captions are running: key changes apply from the next connection. */
  running?: boolean;
}

/** "Deepgram key" section of the settings popover: which key is in use, add/replace/forget. */
export function DeepgramKeySettings({ userKey, serverKey, initiallyEditing = false, running = false }: DeepgramKeySettingsProps) {
  const t = useT("key").settings;
  const [editing, setEditing] = useState(initiallyEditing);
  const [note, setNote] = useState<string | null>(null);
  const mode = keyMode(userKey, serverKey);

  const status =
    mode === "user" ? (
      <>
        {t.usingYours} <span className="font-mono text-ink-300">({maskKey(userKey!)})</span>
      </>
    ) : mode === "server" ? (
      t.usingServer
    ) : mode === "none" ? (
      t.none
    ) : (
      t.checking
    );

  return (
    <section aria-labelledby="deepgram-key-heading" className="space-y-3 text-sm">
      <h3 id="deepgram-key-heading" className="text-xs font-medium tracking-wide text-ink-400 uppercase">
        {t.heading}
      </h3>

      <div className="flex items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-ink-100" data-key-mode={mode}>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${mode === "none" ? "bg-live" : mode === "unknown" ? "bg-ink-500" : "bg-ok"}`}
            aria-hidden="true"
          />
          <span className="min-w-0">{status}</span>
        </p>
        {userKey && (
          <button
            type="button"
            onClick={() => {
              forgetUserKey();
              setNote(serverKey ? t.removedServer : t.removed);
            }}
            className="-my-1 h-7 shrink-0 rounded-lg px-2 text-xs font-semibold text-ink-400 transition-colors hover:bg-live/10 hover:text-[#ff8b96]"
          >
            {t.forget}
          </button>
        )}
      </div>

      {note && <p className="text-xs leading-relaxed text-ink-400">{note}</p>}

      {editing ? (
        <DeepgramKeyForm
          compact
          autoFocus
          onSaved={(persisted) => {
            setEditing(false);
            setNote(
              [persisted ? null : t.tabOnly, running ? t.nextConnection : null]
                .filter(Boolean)
                .join(" ") || null,
            );
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setNote(null);
            setEditing(true);
          }}
          className="h-8 rounded-lg bg-ink-800 px-3 text-xs font-semibold text-ink-100 ring-1 ring-ink-700 transition-colors hover:bg-ink-700"
        >
          {userKey ? t.replace : serverKey ? t.useOwn : t.add}
        </button>
      )}

      <p className="text-xs leading-relaxed text-ink-500">
        {userKey || !serverKey
          ? t.stays
          : t.prefer}
      </p>
    </section>
  );
}
