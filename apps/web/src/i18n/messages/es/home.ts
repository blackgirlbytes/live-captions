import type { home as en } from "../en/home";

export const home: typeof en = {
  hero: {
    title: "Subtítulos y doblaje en vivo para cualquier transmisión.",
    body: "Pega una transmisión para ver subtítulos en vivo, o escúchala doblada con la extensión.",
    orTry: "O prueba una",
  },
  examples: {
    msRachel: "Aprendizaje infantil en vivo",
    skyNews: "Noticias en vivo 24/7",
  },
  form: {
    label: "Enlace del video",
    placeholder: "Pega un enlace de YouTube o Twitch",
    placeholderCompact: "Pega otro enlace de video",
    watch: "Ver",
    watchWithCaptions: "Ver con subtítulos",
    open: "Abrir",
    errors: {
      notALink: "Pega el enlace completo del video, como https://www.youtube.com/watch?v=…",
      unknown: "Heard aún no reconoce ese enlace. Funciona con videos y transmisiones en vivo de YouTube y Twitch.",
      extensionOnly: (platform) =>
        `${platform} no permite insertar sus transmisiones, así que Heard no puede reproducir este enlace aquí. Ábrelo en ${platform} y activa los subtítulos con la extensión de Chrome de Heard.`,
      clip: "Aún no se pueden subtitular clips de Twitch aquí. Pega el enlace del canal o del video, o abre el clip en Twitch y usa la extensión de Chrome de Heard.",
      channel:
        "Los enlaces de canal como @handle/live no se pueden abrir directamente. Abre la transmisión en YouTube, copia el enlace del video (youtube.com/watch?v=… o youtube.com/live/…) y pégalo aquí.",
    },
  },
  how: {
    title: "Cómo funciona",
    intro: "Heard escucha la pestaña directamente, así que funciona aunque el video no tenga subtítulos.",
    pasteTitle: "Pega un enlace",
    pasteBody: "Cualquier video o transmisión en vivo de YouTube.",
    pasteNow: "Pega uno ahora",
    startTitle: "Haz clic en Iniciar subtítulos",
    startBody: "Heard le pide a Chrome solo esta pestaña.",
    shareTitle: "Comparte el audio de la pestaña",
    shareBody: "Elige “Esta pestaña” y deja el audio activado.",
  },
  privacy: {
    title: "Privacidad",
    intro: "Qué escucha Heard, adónde va y qué guarda.",
    openSource: "Heard es de código abierto.",
    policyLink: "Política de privacidad de la extensión de Chrome",
    captionsBy: "Subtítulos de",
    captionsAfter: ".",
    onlyTabTitle: "Solo la pestaña que elijas",
    onlyTabBody: "No se escucha nada más.",
    sentTitle: "Se envía a Deepgram mientras subtitula",
    sentBody: "Detén los subtítulos y se detiene.",
    savedTitle: "No se guarda nada",
    savedBody: "Cierra la pestaña y la transcripción desaparece.",
    artTab: "Pestaña",
    artCaptionsOn: "Subtítulos activos",
  },
  art: {
    startCaptions: "Iniciar subtítulos",
    thisTab: "Esta pestaña",
    window: "Ventana",
    screen: "Pantalla",
    alsoShareAudio: "Compartir audio",
    cancel: "Cancelar",
    share: "Compartir",
  },
};
