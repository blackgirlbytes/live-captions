import type { key as en } from "../en/key";

export const key: typeof en = {
  dialog: {
    title: "Agrega tu clave de Deepgram",
    close: "Cerrar",
    intro:
      "Heard transcribe con Deepgram, y este sitio funciona con tu propia cuenta de Deepgram. Registrarse es gratis y las cuentas nuevas incluyen crédito gratuito.",
    step1: "Regístrate o inicia sesión en",
    step2Before: "Crea una clave de API solo para Heard. Elige el rol ",
    step2Role: "Member",
    step2After: " (el de menor acceso) y ponle una fecha de vencimiento, para poder revocarla cuando quieras.",
    step3: "Pégala aquí. La verificaremos con Deepgram antes de guardarla.",
    privacyStrong: "Tu clave se queda en este navegador y solo se envía a Deepgram.",
    privacyRest: "El servidor de Heard nunca la ve. Puedes eliminarla cuando quieras en la configuración de subtítulos.",
  },
  form: {
    label: "Clave de API de Deepgram",
    placeholder: "Pega tu clave",
    hide: "Ocultar clave",
    show: "Mostrar clave",
    checking: "Verificando con Deepgram…",
    submit: "Verificar y guardar",
    cancel: "Cancelar",
    getKey: "Obtener una clave",
    errors: {
      empty: "Primero pega tu clave de API de Deepgram.",
      malformed:
        "Eso no parece una clave de API de Deepgram. Copia la clave completa desde la consola de Deepgram (solo se muestra una vez, justo después de crearla).",
      rejected: "Deepgram no aceptó esa clave. Revisa que la hayas copiado completa y que no haya vencido ni se haya eliminado.",
      offline: "No se pudo conectar con Deepgram para verificar la clave. Revisa tu conexión e inténtalo de nuevo.",
    },
  },
  settings: {
    heading: "Clave de Deepgram",
    usingYours: "Usando tu clave",
    usingServer: "Usando la clave del servidor",
    none: "Todavía no hay clave. Agrega una para iniciar los subtítulos.",
    checking: "Verificando…",
    forget: "Olvidar clave",
    removedServer: "Clave eliminada. Se vuelve a usar la clave del servidor de Heard.",
    removed: "Clave eliminada de este navegador.",
    tabOnly: "Tu navegador está bloqueando el almacenamiento, así que la clave solo se guarda para esta pestaña.",
    nextConnection: "Se usará desde la próxima conexión; reinicia los subtítulos para cambiar ahora.",
    replace: "Reemplazar clave",
    useOwn: "Usar mi propia clave de Deepgram",
    add: "Agrega tu clave",
    stays: "Tu clave se queda en este navegador y solo se envía a Deepgram.",
    prefer: "¿Prefieres usar tu propia cuenta de Deepgram? Tu clave se queda en este navegador y solo se envía a Deepgram.",
  },
  byok: {
    before: "Necesitarás una ",
    link: "clave de API de Deepgram",
    after: " gratuita. Se queda en tu navegador y solo se envía a Deepgram, nunca al servidor de Heard.",
  },
};
