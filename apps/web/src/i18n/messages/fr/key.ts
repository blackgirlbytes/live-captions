import type { key as en } from "../en/key";

export const key: typeof en = {
  dialog: {
    title: "Ajoutez votre clé Deepgram",
    close: "Fermer",
    intro:
      "Heard transcrit avec Deepgram, et ce site fonctionne avec votre propre compte Deepgram. L’inscription est gratuite et les nouveaux comptes reçoivent du crédit gratuit.",
    step1: "Inscrivez-vous ou connectez-vous sur",
    step2Before: "Créez une clé API réservée à Heard. Choisissez le rôle ",
    step2Role: "Member",
    step2After: " (l’accès le plus restreint) et définissez une date d’expiration, pour pouvoir la révoquer à tout moment.",
    step3: "Collez-la ici. Nous la vérifions auprès de Deepgram avant de l’enregistrer.",
    privacyStrong: "Votre clé reste dans ce navigateur et n’est envoyée qu’à Deepgram.",
    privacyRest: "Le serveur de Heard ne la voit jamais. Supprimez-la à tout moment dans les réglages des sous-titres.",
  },
  form: {
    label: "Clé API Deepgram",
    placeholder: "Collez votre clé",
    hide: "Masquer la clé",
    show: "Afficher la clé",
    checking: "Vérification auprès de Deepgram…",
    submit: "Vérifier et enregistrer",
    cancel: "Annuler",
    getKey: "Obtenir une clé",
    errors: {
      empty: "Collez d’abord votre clé API Deepgram.",
      malformed:
        "Cela ne ressemble pas à une clé API Deepgram. Copiez la clé entière depuis la console Deepgram (elle n’est affichée qu’une fois, juste après sa création).",
      rejected: "Deepgram n’a pas accepté cette clé. Vérifiez que vous l’avez copiée en entier et qu’elle n’a pas expiré ni été supprimée.",
      offline: "Impossible de joindre Deepgram pour vérifier la clé. Vérifiez votre connexion et réessayez.",
    },
  },
  settings: {
    heading: "Clé Deepgram",
    usingYours: "Votre clé est utilisée",
    usingServer: "La clé du serveur est utilisée",
    none: "Pas encore de clé. Ajoutez-en une pour lancer les sous-titres.",
    checking: "Vérification…",
    forget: "Oublier la clé",
    removedServer: "Clé supprimée. La clé du serveur de Heard est de nouveau utilisée.",
    removed: "Clé supprimée de ce navigateur.",
    tabOnly: "Votre navigateur bloque le stockage : la clé est conservée pour cet onglet uniquement.",
    nextConnection: "Elle sera utilisée dès la prochaine connexion ; relancez les sous-titres pour changer maintenant.",
    replace: "Remplacer la clé",
    useOwn: "Utiliser ma propre clé Deepgram",
    add: "Ajoutez votre clé",
    stays: "Votre clé reste dans ce navigateur et n’est envoyée qu’à Deepgram.",
    prefer: "Vous préférez votre propre compte Deepgram ? Votre clé reste dans ce navigateur et n’est envoyée qu’à Deepgram.",
  },
  byok: {
    before: "Il vous faut une ",
    link: "clé API Deepgram",
    after: " gratuite. Elle reste dans votre navigateur et n’est envoyée qu’à Deepgram, jamais au serveur de Heard.",
  },
};
