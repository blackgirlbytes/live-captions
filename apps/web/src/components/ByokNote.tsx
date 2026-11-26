"use client";

import { useServerKeyStatus } from "@/lib/deepgram-key";

/** Home page note, shown only when this deployment has no server Deepgram key. */
export function ByokNote() {
  const [serverKey] = useServerKeyStatus();
  if (serverKey !== false) return null;
  return (
    <li>
      You’ll need a free{" "}
      <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
        Deepgram API key
      </a>
      . It stays in your browser and goes only to Deepgram, never to Earshot’s server.
    </li>
  );
}
