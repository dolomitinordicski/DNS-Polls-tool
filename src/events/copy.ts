import type { Language } from '../utils/i18n';

const messages = {
  de: {
    events: 'Veranstaltungen', create: 'Veranstaltung erstellen',
    preview: 'Organisator-Vorschau: öffentliche Anmeldungen sind noch nicht aktiv.',
    title: 'Titel', description: 'Beschreibung', location: 'Ort',
    date: 'Datum und Uhrzeit', register: 'Jetzt anmelden',
    firstName: 'Vorname', lastName: 'Nachname', email: 'E-Mail',
    questions: 'Zusätzliche Fragen', addQuestion: 'Frage hinzufügen',
    fieldLabel: 'Frage', fieldType: 'Antworttyp', required: 'Pflichtfeld',
    text: 'Kurzer Text', select: 'Auswahl', checkbox: 'Ja/Nein',
    options: 'Optionen (durch Komma getrennt)', save: 'Veröffentlichen',
    loading: 'Laden…', participants: 'Anmeldungen', noEvents: 'Noch keine Veranstaltungen.',
    noRegistrations: 'Noch keine Anmeldungen.', success: 'Anmeldung gespeichert. Vielen Dank!',
    failed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    closed: 'Die Anmeldung ist geschlossen.', copy: 'Einladungslink kopieren',
    copied: 'Link kopiert', login: 'Als DNS-Organisator anmelden',
    loginHint: 'Zur Verwaltung ist ein autorisiertes DNS-Konto erforderlich.',
    back: 'Zurück zur Übersicht', allPolls: 'Terminumfragen',
    privacy: 'Ihre Kontaktdaten sind nur für autorisierte DNS-Organisatoren sichtbar.',
    invalid: 'Bitte alle Pflichtfelder ausfüllen.', unavailable: 'Veranstaltung nicht gefunden.',
    format: 'Format', export: 'CSV exportieren', remove: 'Entfernen',
  },
  it: {
    events: 'Eventi', create: 'Crea evento',
    preview: 'Anteprima organizzatore: le iscrizioni pubbliche non sono ancora attive.',
    title: 'Titolo', description: 'Descrizione', location: 'Luogo',
    date: 'Data e ora', register: 'Iscriviti',
    firstName: 'Nome', lastName: 'Cognome', email: 'Email',
    questions: 'Domande aggiuntive', addQuestion: 'Aggiungi domanda',
    fieldLabel: 'Domanda', fieldType: 'Tipo risposta', required: 'Obbligatoria',
    text: 'Testo breve', select: 'Scelta', checkbox: 'Sì/No',
    options: 'Opzioni (separate da virgola)', save: 'Pubblica',
    loading: 'Caricamento…', participants: 'Iscrizioni', noEvents: 'Nessun evento ancora.',
    noRegistrations: 'Nessuna iscrizione.', success: 'Iscrizione registrata. Grazie!',
    failed: 'Salvataggio non riuscito. Riprova.',
    closed: 'Le iscrizioni sono chiuse.', copy: 'Copia link invito',
    copied: 'Link copiato', login: 'Accedi come organizzatore DNS',
    loginHint: 'Per gestire gli eventi è richiesto un account DNS autorizzato.',
    back: 'Torna agli eventi', allPolls: 'Sondaggi date',
    privacy: 'I tuoi contatti sono visibili solo agli organizzatori DNS autorizzati.',
    invalid: 'Compila tutti i campi obbligatori.', unavailable: 'Evento non trovato.',
    format: 'Formato', export: 'Esporta CSV', remove: 'Rimuovi',
  },
} as const;

export function eventCopy(lang: Language) {
  return messages[lang];
}
