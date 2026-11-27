import type { key as en } from "../en/key";

export const key: typeof en = {
  dialog: {
    title: "Deepgram-Schlüssel hinzufügen",
    close: "Schließen",
    intro:
      "Heard transkribiert mit Deepgram, und diese Seite läuft über dein eigenes Deepgram-Konto. Die Registrierung ist kostenlos, und neue Konten erhalten ein Gratisguthaben.",
    step1: "Registriere dich oder melde dich an unter",
    step2Before: "Erstelle einen API-Schlüssel nur für Heard. Wähle die Rolle ",
    step2Role: "Member",
    step2After: " (geringste Rechte) und lege ein Ablaufdatum fest, damit du ihn jederzeit widerrufen kannst.",
    step3: "Füge ihn hier ein. Wir prüfen ihn vor dem Speichern bei Deepgram.",
    privacyStrong: "Dein Schlüssel bleibt in diesem Browser und geht nur an Deepgram.",
    privacyRest: "Der Server von Heard sieht ihn nie. Du kannst ihn jederzeit in den Untertitel-Einstellungen entfernen.",
  },
  form: {
    label: "Deepgram-API-Schlüssel",
    placeholder: "Schlüssel einfügen",
    hide: "Schlüssel verbergen",
    show: "Schlüssel anzeigen",
    checking: "Wird bei Deepgram geprüft…",
    submit: "Prüfen & speichern",
    cancel: "Abbrechen",
    getKey: "Schlüssel holen",
    errors: {
      empty: "Füge zuerst deinen Deepgram-API-Schlüssel ein.",
      malformed:
        "Das sieht nicht wie ein Deepgram-API-Schlüssel aus. Kopiere den ganzen Schlüssel aus der Deepgram-Konsole (er wird nur einmal angezeigt, direkt nach dem Erstellen).",
      rejected: "Deepgram hat diesen Schlüssel nicht akzeptiert. Prüfe, ob du ihn vollständig kopiert hast und ob er abgelaufen oder gelöscht ist.",
      offline: "Deepgram war zum Prüfen des Schlüssels nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.",
    },
  },
  settings: {
    heading: "Deepgram-Schlüssel",
    usingYours: "Dein Schlüssel wird verwendet",
    usingServer: "Server-Schlüssel wird verwendet",
    none: "Noch kein Schlüssel. Füge einen hinzu, um Untertitel zu starten.",
    checking: "Wird geprüft…",
    forget: "Schlüssel vergessen",
    removedServer: "Schlüssel entfernt. Der Server-Schlüssel von Heard wird wieder verwendet.",
    removed: "Schlüssel aus diesem Browser entfernt.",
    tabOnly: "Dein Browser blockiert den Speicher, daher bleibt der Schlüssel nur in diesem Tab erhalten.",
    nextConnection: "Er gilt ab der nächsten Verbindung; starte die Untertitel neu, um jetzt zu wechseln.",
    replace: "Schlüssel ersetzen",
    useOwn: "Eigenen Deepgram-Schlüssel verwenden",
    add: "Schlüssel hinzufügen",
    stays: "Dein Schlüssel bleibt in diesem Browser und geht nur an Deepgram.",
    prefer: "Lieber dein eigenes Deepgram-Konto? Dein Schlüssel bleibt in diesem Browser und geht nur an Deepgram.",
  },
  byok: {
    before: "Du brauchst einen kostenlosen ",
    link: "Deepgram-API-Schlüssel",
    after: ". Er bleibt in deinem Browser und geht nur an Deepgram, nie an den Server von Heard.",
  },
};
