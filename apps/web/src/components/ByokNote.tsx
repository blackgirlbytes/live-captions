"use client";

import { useServerKeyStatus } from "@/lib/deepgram-key";
import { useT } from "@/i18n/I18nProvider";

/** Home page note, shown only when this deployment has no server Deepgram key. */
export function ByokNote() {
  const [serverKey] = useServerKeyStatus();
  const t = useT("key").byok;
  if (serverKey !== false) return null;
  return (
    <li>
      {t.before}
      <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
        {t.link}
      </a>
      {t.after}
    </li>
  );
}
