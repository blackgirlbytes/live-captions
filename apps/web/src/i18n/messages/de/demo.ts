import type { demo as en } from "../en/demo";

export const demo: typeof en = {
  group: "Heard ausprobieren: ein Demo-Player mit Live-Untertiteln, dem Popup der Chrome-Erweiterung und dem Transkript",
  listening: "Hört zu",
  notListening: "Hört nicht zu",
  startCaptions: "Untertitel an",
  stopCaptions: "Untertitel aus",
  popup: {
    live: "Live",
    off: "Aus",
    statusLive: "Transkription live",
    statusOff: "Transkription aus",
    aiCaptions: "KI-Untertitel",
    onText: "Untertitelt diesen Tab auf youtube.com",
    offText: "Einschalten, um alles in diesem Tab zu untertiteln.",
  },
  controls: {
    showCaptions: "Untertitel einblenden",
    hideCaptions: "Untertitel ausblenden",
    transcriptPanel: "Transkript-Bereich",
    showTranscript: "Transkript einblenden",
    hideTranscript: "Transkript ausblenden",
    fullScreen: "Vollbild",
    exitFullScreen: "Vollbild beenden",
  },
  transcript: {
    title: "Transkript",
    download: "Herunterladen",
    empty: "Hier erscheinen die Sätze, sobald sie gesprochen werden.",
    noMatches: "Keine Treffer",
    jumpTo: (time: string) => `Zu ${time} springen`,
    search: "Transkript durchsuchen",
    clearSearch: "Suche löschen",
  },
  video: {
    play: "Video abspielen",
    pause: "Video pausieren",
    liveCaptions: "Live-Untertitel",
    captionsOff: "Untertitel aus",
    seek: "Position",
    seekValue: (now: string, total: string) => `${now} von ${total}`,
  },
};
