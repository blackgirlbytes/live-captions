import type { demo as en } from "../en/demo";

export const demo: typeof en = {
  group: "Essayez Heard : un lecteur de démonstration avec sous-titres en direct, la fenêtre de l’extension Chrome et la transcription",
  listening: "À l’écoute",
  notListening: "En pause",
  startCaptions: "Sous-titrer",
  stopCaptions: "Arrêter",
  popup: {
    live: "En direct",
    off: "Désactivé",
    statusLive: "Transcription en direct",
    statusOff: "Transcription désactivée",
    aiCaptions: "Sous-titres IA",
    onText: "Sous-titrage de cet onglet sur youtube.com",
    offText: "Activez pour sous-titrer ce qui est lu dans cet onglet.",
  },
  controls: {
    showCaptions: "Afficher les sous-titres",
    hideCaptions: "Masquer les sous-titres",
    transcriptPanel: "Panneau de transcription",
    showTranscript: "Afficher la transcription",
    hideTranscript: "Masquer la transcription",
    fullScreen: "Plein écran",
    exitFullScreen: "Quitter le plein écran",
  },
  transcript: {
    title: "Transcription",
    download: "Télécharger",
    empty: "Les phrases s’affichent ici au fil de la parole.",
    noMatches: "Aucun résultat",
    jumpTo: (time: string) => `Aller à ${time}`,
    search: "Rechercher dans la transcription",
    clearSearch: "Effacer la recherche",
  },
  video: {
    play: "Lire la vidéo",
    pause: "Mettre en pause",
    liveCaptions: "Sous-titres en direct",
    captionsOff: "Sous-titres désactivés",
    seek: "Position",
    seekValue: (now: string, total: string) => `${now} sur ${total}`,
  },
};
