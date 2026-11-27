import type { demo as en } from "../en/demo";

export const demo: typeof en = {
  group: "Prueba Heard: un reproductor de demostración con subtítulos en vivo, la ventana de la extensión de Chrome y la transcripción",
  listening: "Escuchando",
  notListening: "Sin escuchar",
  startCaptions: "Subtitular",
  stopCaptions: "Detener",
  popup: {
    live: "En vivo",
    off: "Apagado",
    statusLive: "Transcripción en vivo",
    statusOff: "Transcripción apagada",
    aiCaptions: "Subtítulos con IA",
    onText: "Subtitulando esta pestaña en youtube.com",
    offText: "Actívalo para subtitular lo que se reproduzca en esta pestaña.",
  },
  controls: {
    showCaptions: "Mostrar subtítulos",
    hideCaptions: "Ocultar subtítulos",
    transcriptPanel: "Panel de transcripción",
    showTranscript: "Mostrar transcripción",
    hideTranscript: "Ocultar transcripción",
    fullScreen: "Pantalla completa",
    exitFullScreen: "Salir de pantalla completa",
  },
  transcript: {
    title: "Transcripción",
    download: "Descargar",
    empty: "Las frases aparecen aquí a medida que se dicen.",
    noMatches: "Sin resultados",
    jumpTo: (time: string) => `Ir a ${time}`,
    search: "Buscar en la transcripción",
    clearSearch: "Borrar búsqueda",
  },
  video: {
    play: "Reproducir video",
    pause: "Pausar video",
    liveCaptions: "Subtítulos en vivo",
    captionsOff: "Subtítulos apagados",
    seek: "Buscar posición",
    seekValue: (now: string, total: string) => `${now} de ${total}`,
  },
};
