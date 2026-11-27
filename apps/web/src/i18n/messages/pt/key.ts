import type { key as en } from "../en/key";

export const key: typeof en = {
  dialog: {
    title: "Adicione sua chave do Deepgram",
    close: "Fechar",
    intro:
      "O Heard transcreve com o Deepgram, e este site funciona com a sua própria conta do Deepgram. O cadastro é gratuito e contas novas vêm com crédito grátis.",
    step1: "Cadastre-se ou entre em",
    step2Before: "Crie uma chave de API só para o Heard. Escolha a função ",
    step2Role: "Member",
    step2After: " (o menor acesso) e defina uma data de expiração, para poder revogá-la quando quiser.",
    step3: "Cole aqui. Vamos verificá-la com o Deepgram antes de salvar.",
    privacyStrong: "Sua chave fica neste navegador e só é enviada ao Deepgram.",
    privacyRest: "O servidor do Heard nunca a vê. Remova quando quiser nas configurações de legendas.",
  },
  form: {
    label: "Chave de API do Deepgram",
    placeholder: "Cole sua chave",
    hide: "Ocultar chave",
    show: "Mostrar chave",
    checking: "Verificando com o Deepgram…",
    submit: "Verificar e salvar",
    cancel: "Cancelar",
    getKey: "Obter uma chave",
    errors: {
      empty: "Cole primeiro sua chave de API do Deepgram.",
      malformed:
        "Isso não parece uma chave de API do Deepgram. Copie a chave inteira no console do Deepgram (ela só aparece uma vez, logo depois de criada).",
      rejected: "O Deepgram não aceitou essa chave. Confira se você copiou tudo e se ela não expirou nem foi excluída.",
      offline: "Não foi possível falar com o Deepgram para verificar a chave. Confira sua conexão e tente de novo.",
    },
  },
  settings: {
    heading: "Chave do Deepgram",
    usingYours: "Usando sua chave",
    usingServer: "Usando a chave do servidor",
    none: "Nenhuma chave ainda. Adicione uma para iniciar as legendas.",
    checking: "Verificando…",
    forget: "Esquecer chave",
    removedServer: "Chave removida. A chave do servidor do Heard volta a ser usada.",
    removed: "Chave removida deste navegador.",
    tabOnly: "Seu navegador está bloqueando o armazenamento, então a chave fica guardada só nesta aba.",
    nextConnection: "Ela será usada a partir da próxima conexão; reinicie as legendas para trocar agora.",
    replace: "Substituir chave",
    useOwn: "Usar minha própria chave do Deepgram",
    add: "Adicione sua chave",
    stays: "Sua chave fica neste navegador e só é enviada ao Deepgram.",
    prefer: "Prefere usar sua própria conta do Deepgram? Sua chave fica neste navegador e só é enviada ao Deepgram.",
  },
  byok: {
    before: "Você vai precisar de uma ",
    link: "chave de API do Deepgram",
    after: " gratuita. Ela fica no seu navegador e só é enviada ao Deepgram, nunca ao servidor do Heard.",
  },
};
