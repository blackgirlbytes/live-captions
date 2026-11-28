import type { home as en } from "../en/home";

export const home: typeof en = {
  hero: {
    title: "Live-Untertitel und Synchronisation für jeden Stream.",
    body: "Füge einen Stream für Live-Untertitel ein oder hör ihn mit der Erweiterung synchronisiert.",
    orTry: "Oder probier einen aus",
  },
  examples: {
    msRachel: "Live-Lernen für Kleinkinder",
    skyNews: "Live-Nachrichten rund um die Uhr",
  },
  form: {
    label: "Videolink",
    placeholder: "YouTube- oder Twitch-Link einfügen",
    placeholderCompact: "Anderen Videolink einfügen",
    watch: "Ansehen",
    watchWithCaptions: "Mit Untertiteln ansehen",
    open: "Öffnen",
    errors: {
      notALink: "Füge einen vollständigen Videolink ein, z. B. https://www.youtube.com/watch?v=…",
      unknown: "Heard erkennt diesen Link noch nicht. Unterstützt werden Videos und Livestreams von YouTube und Twitch.",
      extensionOnly: (platform) =>
        `${platform} erlaubt kein Einbetten seiner Streams, daher kann Heard diesen Link hier nicht abspielen. Öffne ihn auf ${platform} und schalte die Untertitel mit der Chrome-Erweiterung von Heard ein.`,
      clip: "Twitch-Clips lassen sich hier noch nicht untertiteln. Füge stattdessen den Kanal- oder Videolink ein oder öffne den Clip auf Twitch und nutze die Chrome-Erweiterung von Heard.",
      channel:
        "Kanallinks wie @handle/live lassen sich nicht direkt öffnen. Öffne den Stream auf YouTube, kopiere den Videolink (youtube.com/watch?v=… oder youtube.com/live/…) und füge ihn hier ein.",
    },
  },
  how: {
    title: "So funktioniert’s",
    intro: "Heard hört direkt auf den Tab, daher klappt es auch, wenn ein Video keine Untertitel hat.",
    pasteTitle: "Link einfügen",
    pasteBody: "Jedes YouTube-Video und jeder Livestream.",
    pasteNow: "Jetzt einfügen",
    startTitle: "Auf Untertitel starten klicken",
    startBody: "Heard fragt Chrome nur nach diesem Tab.",
    shareTitle: "Audio des Tabs teilen",
    shareBody: "Wähle „Dieser Tab“ und lass Audio an.",
  },
  privacy: {
    title: "Datenschutz",
    intro: "Was Heard hört, wohin es geht und was gespeichert wird.",
    openSource: "Heard ist Open Source.",
    policyLink: "Datenschutzerklärung der Chrome-Erweiterung",
    captionsBy: "Untertitel von",
    captionsAfter: ".",
    onlyTabTitle: "Nur der Tab, den du wählst",
    onlyTabBody: "Sonst wird nichts gehört.",
    sentTitle: "Während der Untertitelung an Deepgram",
    sentBody: "Untertitel stoppen, und es endet.",
    savedTitle: "Nichts wird gespeichert",
    savedBody: "Tab schließen, und das Transkript ist weg.",
    artTab: "Tab",
    artCaptionsOn: "Untertitel an",
  },
  art: {
    startCaptions: "Untertitel starten",
    thisTab: "Dieser Tab",
    window: "Fenster",
    screen: "Bildschirm",
    alsoShareAudio: "Tab-Audio teilen",
    cancel: "Abbrechen",
    share: "Teilen",
  },
};
