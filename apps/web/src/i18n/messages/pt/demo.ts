import type { demo as en } from "../en/demo";

export const demo: typeof en = {
  group: "Experimente o Heard: um player de demonstração com legendas ao vivo, a janela da extensão do Chrome e a transcrição",
  listening: "Ouvindo",
  notListening: "Sem ouvir",
  startCaptions: "Legendar",
  stopCaptions: "Parar",
  popup: {
    live: "Ao vivo",
    off: "Desligado",
    statusLive: "Transcrição ao vivo",
    statusOff: "Transcrição desligada",
    aiCaptions: "Legendas com IA",
    onText: "Legendando esta aba no youtube.com",
    offText: "Ative para legendar o que estiver tocando nesta aba.",
  },
  controls: {
    showCaptions: "Mostrar legendas",
    hideCaptions: "Ocultar legendas",
    transcriptPanel: "Painel de transcrição",
    showTranscript: "Mostrar transcrição",
    hideTranscript: "Ocultar transcrição",
    fullScreen: "Tela cheia",
    exitFullScreen: "Sair da tela cheia",
  },
  transcript: {
    title: "Transcrição",
    download: "Baixar",
    empty: "As falas aparecem aqui conforme são ditas.",
    noMatches: "Nenhum resultado",
    jumpTo: (time: string) => `Ir para ${time}`,
    search: "Pesquisar na transcrição",
    clearSearch: "Limpar pesquisa",
  },
  video: {
    play: "Reproduzir vídeo",
    pause: "Pausar vídeo",
    liveCaptions: "Legendas ao vivo",
    captionsOff: "Legendas desligadas",
    seek: "Posição",
    seekValue: (now: string, total: string) => `${now} de ${total}`,
  },
};
