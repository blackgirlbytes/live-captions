import type { home as en } from "../en/home";

export const home: typeof en = {
  hero: {
    title: "Legendas e dublagem ao vivo para qualquer transmissão.",
    body: "Cole uma transmissão para ver legendas ao vivo, ou ouça dublada com a extensão.",
    orTry: "Ou experimente uma",
  },
  examples: {
    msRachel: "Aprendizado infantil ao vivo",
    skyNews: "Notícias ao vivo 24h",
  },
  form: {
    label: "Link do vídeo",
    placeholder: "Cole um link do YouTube ou da Twitch",
    placeholderCompact: "Cole outro link de vídeo",
    watch: "Assistir",
    watchWithCaptions: "Assistir com legendas",
    open: "Abrir",
    errors: {
      notALink: "Cole o link completo do vídeo, como https://www.youtube.com/watch?v=…",
      unknown: "O Heard ainda não reconhece esse link. Vídeos e lives do YouTube e da Twitch são compatíveis.",
      extensionOnly: (platform) =>
        `O ${platform} não permite incorporar as transmissões, então o Heard não consegue reproduzir este link aqui. Abra no ${platform} e ative as legendas com a extensão do Heard para Chrome.`,
      clip: "Ainda não dá para legendar clipes da Twitch aqui. Cole o link do canal ou do vídeo, ou abra o clipe na Twitch e use a extensão do Heard para Chrome.",
      channel:
        "Links de canal como @handle/live não podem ser abertos diretamente. Abra a live no YouTube, copie o link do vídeo (youtube.com/watch?v=… ou youtube.com/live/…) e cole aqui.",
    },
  },
  how: {
    title: "Como funciona",
    intro: "O Heard ouve a própria guia, então funciona mesmo quando o vídeo não tem legendas.",
    pasteTitle: "Cole um link",
    pasteBody: "Qualquer vídeo ou live do YouTube.",
    pasteNow: "Cole um agora",
    startTitle: "Clique em Iniciar legendas",
    startBody: "O Heard pede ao Chrome só esta guia.",
    shareTitle: "Compartilhe o áudio da guia",
    shareBody: "Escolha “Esta guia” e deixe o áudio ativado.",
  },
  privacy: {
    title: "Privacidade",
    intro: "O que o Heard ouve, para onde vai e o que ele guarda.",
    openSource: "O Heard é código aberto.",
    policyLink: "Política de privacidade da extensão para Chrome",
    captionsBy: "Legendas por",
    captionsAfter: ".",
    onlyTabTitle: "Só a guia que você escolher",
    onlyTabBody: "Nada mais é ouvido.",
    sentTitle: "Enviado ao Deepgram durante as legendas",
    sentBody: "Pare as legendas e o envio para.",
    savedTitle: "Nada é salvo",
    savedBody: "Feche a guia e a transcrição some.",
    artTab: "Guia",
    artCaptionsOn: "Legendas ativas",
  },
  art: {
    startCaptions: "Iniciar legendas",
    thisTab: "Esta guia",
    window: "Janela",
    screen: "Tela",
    alsoShareAudio: "Compartilhar áudio",
    cancel: "Cancelar",
    share: "Compartilhar",
  },
};
