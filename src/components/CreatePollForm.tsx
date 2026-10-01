import React, { useMemo, useState } from 'react';
import {
  AlignLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Mail,
  MapPin,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { Poll, TimeSlot } from '../types';
import { formatDate } from '../utils/dateUtils';
import { savePollToFirestore } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import {
  getAutocompleteData,
  saveAutocompleteEntry,
} from '../utils/autocompleteStore';
import { parsePollPrompt } from '../utils/localPromptParser';
import { parseRecipientEmails, savePollRecipientsSynced } from '../utils/pollRecipientStore';
import { PrivateRecipientSyncControl } from './PrivateRecipientSyncControl';

const PROMPT_HELPERS = {
  it: `Trasforma il testo che ti invio in un prompt pronto per DNS Polls. Restituisci SOLO il prompt finale, senza spiegazioni. Strutturalo così: titolo della riunione; luogo oppure "Online"; breve descrizione/ordine del giorno; tutte le date complete con TUTTE le fasce orarie per ciascun giorno. Usa date esplicite (es. 1 ottobre 2026) e orari nel formato 08:00-09:30. Se più date hanno gli stessi orari, puoi raggrupparle (es. 1, 2, 6 e 7 ottobre: 08:00-09:30, 10:00-11:30, 14:00-15:30). Non inserire organizzatore o email: DNS Polls li compila automaticamente. Testo da trasformare:`,
  de: `Formatiere den Text, den ich dir sende, als direkt verwendbaren Prompt für DNS Polls. Gib NUR den fertigen Prompt zurück, ohne Erklärungen. Struktur: Titel der Sitzung; Ort oder "Online"; kurze Beschreibung/Tagesordnung; alle vollständigen Termine mit ALLEN Zeitfenstern pro Tag. Verwende explizite Daten (z.B. 1. Oktober 2026) und Uhrzeiten im Format 08:00-09:30. Wenn mehrere Tage dieselben Zeiten haben, dürfen sie gruppiert werden (z.B. 1, 2, 6 und 7 Oktober: 08:00-09:30, 10:00-11:30, 14:00-15:30). Organisator und E-Mail nicht angeben: DNS Polls füllt sie automatisch aus. Zu formatierender Text:`,
  en: `Convert the text I send you into a prompt ready for DNS Polls. Return ONLY the final prompt, with no explanation. Structure it as: meeting title; location or "Online"; short description/agenda; every full date with ALL time slots for each day. Use explicit dates (e.g. 1 October 2026) and times in the format 08:00-09:30. If several dates have the same times, they may be grouped (e.g. 1, 2, 6 and 7 October: 08:00-09:30, 10:00-11:30, 14:00-15:30). Do not include organizer or email: DNS Polls fills those automatically. Text to convert:`,
} as const;

interface CreatePollFormProps {
  onPollCreated: (poll: Poll) => void;
  onCancel: () => void;
  currentLang: Language;
  initialPromptMode?: boolean;
}

function createSlotId() {
  return `slot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export const CreatePollForm: React.FC<CreatePollFormProps> = ({
  onPollCreated,
  onCancel,
  currentLang,
  initialPromptMode = true,
}) => {
  const autocomplete = useMemo(() => getAutocompleteData(), []);

  const copy = currentLang === 'de'
    ? {
        kicker: 'Neue Terminumfrage',
        assistant: 'Text-Assistent',
        assistantDesc: 'Unstrukturierten Text lokal in Felder und Termine umwandeln.',
        showAssistant: 'Text-Assistent öffnen',
        hideAssistant: 'Text-Assistent schließen',
        helperTitle: 'Prompt-Anweisung für ChatGPT',
        helperDesc: 'Optional: Anleitung kopieren, Rohtext extern strukturieren und das Ergebnis hier einfügen.',
        copyInstruction: 'Anweisung kopieren',
        copied: 'Kopiert',
        detailsKicker: '01 · Sitzung',
        datesKicker: '02 · Termine',
        optionsKicker: '03 · Antworten',
        recipientsKicker: '04 · Empfänger',
        recipientsTitle: 'Einladungsliste',
        recipientsHint: 'E-Mail-Adressen für diese Umfrage. Eine Adresse pro Zeile oder durch Komma/Semikolon getrennt. Lokal funktioniert die Liste immer; mit privatem Cloud-Sync ist sie auch auf anderen angemeldeten Browsern verfügbar.',
        recipientsPlaceholder: 'name@example.com\nteam@example.com',
        recipientsSummary: 'Empfänger',
        summaryKicker: 'Übersicht',
        summaryTitle: 'Vor dem Erstellen',
        detailsReady: 'Sitzungsdaten',
        datesReady: 'Terminoptionen',
        responseMode: 'Antwortmodus',
        ready: 'Bereit',
        missing: 'Fehlt',
        yesMaybeNo: 'Ja · Falls nötig · Nein',
        yesNo: 'Ja · Nein',
        dateHint: 'Datum und Uhrzeit hinzufügen. Eingefügte Uhrzeiten können direkt bearbeitet werden.',
        addOption: 'Termin hinzufügen',
        editTime: 'Uhrzeit bearbeiten',
        removeSlot: 'Termin entfernen',
        emptySlots: 'Noch keine Termine. Fügen Sie mindestens eine Option hinzu.',
        promptApplied: 'Angaben übernommen',
        localNote: 'Die Analyse erfolgt lokal im Browser.',
        create: 'Umfrage erstellen',
        creating: 'Wird erstellt…',
        cancel: 'Abbrechen',
        examples: 'Beispiele',
        presets: 'Zeitvorlagen',
        clearAll: 'Alle entfernen',
        optional: 'Optional',
        required: 'Pflichtfeld',
        formError: 'Bitte prüfen Sie die markierten Pflichtangaben.',
      }
    : {
        kicker: 'Nuovo sondaggio date',
        assistant: 'Assistente testo',
        assistantDesc: 'Trasforma localmente un testo libero in campi e date.',
        showAssistant: 'Apri assistente testo',
        hideAssistant: 'Chiudi assistente testo',
        helperTitle: 'Istruzione prompt per ChatGPT',
        helperDesc: 'Opzionale: copia l’istruzione, struttura fuori dall’app il testo grezzo e reincolla qui il risultato.',
        copyInstruction: 'Copia istruzione',
        copied: 'Copiato',
        detailsKicker: '01 · Riunione',
        datesKicker: '02 · Date',
        optionsKicker: '03 · Risposte',
        recipientsKicker: '04 · Destinatari',
        recipientsTitle: 'Lista inviti',
        recipientsHint: 'Indirizzi e-mail per questo sondaggio. Uno per riga oppure separati da virgola/punto e virgola. La lista funziona sempre in locale; con il sync cloud privato è disponibile anche sugli altri browser autenticati.',
        recipientsPlaceholder: 'nome@example.com\nteam@example.com',
        recipientsSummary: 'Destinatari',
        summaryKicker: 'Riepilogo',
        summaryTitle: 'Prima di creare',
        detailsReady: 'Dati riunione',
        datesReady: 'Opzioni data',
        responseMode: 'Modalità risposta',
        ready: 'Pronto',
        missing: 'Manca',
        yesMaybeNo: 'Sì · Se necessario · No',
        yesNo: 'Sì · No',
        dateHint: 'Aggiungi data e orario. Gli orari inseriti restano modificabili direttamente.',
        addOption: 'Aggiungi data',
        editTime: 'Modifica orario',
        removeSlot: 'Rimuovi data',
        emptySlots: 'Nessuna data inserita. Aggiungi almeno un’opzione.',
        promptApplied: 'Dati inseriti',
        localNote: 'L’analisi avviene localmente nel browser.',
        create: 'Crea sondaggio',
        creating: 'Creazione…',
        cancel: 'Annulla',
        examples: 'Esempi',
        presets: 'Orari rapidi',
        clearAll: 'Rimuovi tutti',
        optional: 'Opzionale',
        required: 'Obbligatorio',
        formError: 'Controlla i campi obbligatori indicati.',
      };

  const [showAssistant, setShowAssistant] = useState(initialPromptMode);
  const [showPromptHelpers, setShowPromptHelpers] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [promptSuccessMessage, setPromptSuccessMessage] = useState('');
  const [promptErrorMessage, setPromptErrorMessage] = useState('');
  const [copiedHelper, setCopiedHelper] = useState<'it' | 'de' | 'en' | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [organizerName, setOrganizerName] = useState('Dolomiti NordicSki');
  const [organizerEmail, setOrganizerEmail] = useState('management@dolomitinordicski.com');
  const [allowMaybe, setAllowMaybe] = useState(true);
  const [recipientInput, setRecipientInput] = useState('');

  const [selectedDate, setSelectedDate] = useState('');
  const [customTime, setCustomTime] = useState('09:30 - 11:00');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const slotsByDate = useMemo(() => {
    return [...slots]
      .sort((a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || '').localeCompare(b.time || ''),
      )
      .reduce<Record<string, TimeSlot[]>>((groups, slot) => {
        (groups[slot.date] ??= []).push(slot);
        return groups;
      }, {});
  }, [slots]);

  const detailsReady = Boolean(title.trim() && organizerName.trim());
  const datesReady = slots.length > 0;
  const recipients = useMemo(
    () => parseRecipientEmails(recipientInput),
    [recipientInput],
  );

  const handleGenerateFromPrompt = (textToUse?: string) => {
    const query = (textToUse ?? promptText).trim();

    if (!query) {
      setPromptErrorMessage(
        currentLang === 'de'
          ? 'Bitte geben Sie zuerst einen Text ein.'
          : 'Inserisci prima un testo.',
      );
      return;
    }

    setPromptErrorMessage('');
    setPromptSuccessMessage('');

    try {
      const data = parsePollPrompt(query, currentLang);

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.location) setLocation(data.location);

      setOrganizerName('Dolomiti NordicSki');
      setOrganizerEmail('management@dolomitinordicski.com');

      if (data.slots.length > 0) {
        setSlots(
          data.slots.map(slot => ({
            id: createSlotId(),
            date: slot.date,
            time: slot.time,
          })),
        );
      }

      setPromptSuccessMessage(
        `${copy.promptApplied}. ${copy.localNote}`,
      );
      setError('');
    } catch (parseError) {
      console.error('Local prompt parser could not extract poll data:', parseError);
      setPromptErrorMessage(t('aiPromptError', currentLang));
    }
  };

  const handleAddSlot = (timeToAdd?: string) => {
    if (!selectedDate) {
      setError(
        currentLang === 'de'
          ? 'Bitte wählen Sie ein Datum aus.'
          : 'Seleziona una data.',
      );
      return;
    }

    setError('');
    setSlots(current => [
      ...current,
      {
        id: createSlotId(),
        date: selectedDate,
        time:
          timeToAdd ||
          customTime.trim() ||
          t('allDay', currentLang),
      },
    ]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!detailsReady || !datesReady) {
      if (!title.trim()) setError(t('errTitleRequired', currentLang));
      else if (!organizerName.trim()) setError(t('errOrganizerRequired', currentLang));
      else setError(t('errSlotsRequired', currentLang));
      return;
    }

    setError('');
    setIsSaving(true);

    try {
      saveAutocompleteEntry('organizers', organizerName);
      if (organizerEmail) saveAutocompleteEntry('organizerEmails', organizerEmail);
      if (location) saveAutocompleteEntry('locations', location);

      const newPoll: Poll = {
        id: `poll-${Date.now()}`,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        organizerName: organizerName.trim(),
        organizerEmail: organizerEmail.trim(),
        allowMaybe,
        slots,
        participants: [],
        createdAt: new Date().toISOString(),
      };

      await savePollToFirestore(newPoll);
      await savePollRecipientsSynced(newPoll.id, recipientInput);
      onPollCreated(newPoll);
    } catch (saveError) {
      console.error('Poll creation failed:', saveError);
      setError(
        currentLang === 'de'
          ? 'Die Umfrage konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
          : 'Impossibile salvare il sondaggio. Riprova.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="dns-shell py-5 font-body"
    >
      <datalist id="organizers-list">
        {autocomplete.organizers.map((item, index) => (
          <option key={`org-${index}`} value={item} />
        ))}
      </datalist>
      <datalist id="organizer-emails-list">
        {autocomplete.organizerEmails.map((item, index) => (
          <option key={`email-${index}`} value={item} />
        ))}
      </datalist>
      <datalist id="locations-list">
        {autocomplete.locations.map((item, index) => (
          <option key={`loc-${index}`} value={item} />
        ))}
      </datalist>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-5">
          <section className="dns-card p-5 md:p-6" data-dns-reveal>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div className="max-w-2xl">
                <div className="dns-kicker">{copy.kicker}</div>
                <h1 className="mt-1 text-[27px] font-semibold tracking-[-.02em] text-dns-deep">
                  {t('createTitle', currentLang)}
                </h1>
                <p className="mt-2 font-alt text-[12px] leading-relaxed text-dns-muted">
                  {t('createSubtitle', currentLang)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAssistant(current => !current)}
                data-dns-press
                data-dns-hover
                className="dns-btn-secondary min-h-9 shrink-0"
                aria-expanded={showAssistant}
              >
                <AlignLeft className="h-4 w-4" />
                {showAssistant ? copy.hideAssistant : copy.showAssistant}
              </button>
            </div>
          </section>

          {showAssistant && (
            <section className="dns-card p-5 md:p-6" data-dns-reveal>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="dns-kicker">Local parser</div>
                  <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
                    {copy.assistant}
                  </h2>
                  <p className="mt-1 font-alt text-[11px] leading-relaxed text-dns-muted">
                    {copy.assistantDesc} {copy.localNote}
                  </p>
                </div>
              </div>

              <textarea
                rows={4}
                value={promptText}
                onChange={event => {
                  setPromptText(event.target.value);
                  setPromptErrorMessage('');
                  setPromptSuccessMessage('');
                }}
                placeholder={t('aiPromptPlaceholder', currentLang)}
                className="dns-input mt-4 min-h-[104px] w-full resize-y"
              />

              <div className="mt-3">
                <div className="dns-kicker">{copy.examples}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    t('aiPromptExample1', currentLang),
                    t('aiPromptExample2', currentLang),
                    t('aiPromptExample3', currentLang),
                  ].map((example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        const clean = example.replace(/^[^\w\s]+/, '').trim();
                        setPromptText(clean);
                        handleGenerateFromPrompt(clean);
                      }}
                      data-dns-press
                      data-dns-hover
                      className="rounded-md border border-dns-mid/15 bg-white px-3 py-1.5 font-alt text-[10px] text-dns-mid hover:bg-dns-bg"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-dns-mid/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPromptHelpers(current => !current)}
                  className="flex w-full items-center justify-between gap-3 border-0 bg-transparent p-0 text-left"
                  aria-expanded={showPromptHelpers}
                >
                  <div>
                    <div className="text-[11px] font-semibold text-dns-deep">
                      {copy.helperTitle}
                    </div>
                    <div className="mt-0.5 font-alt text-[10px] text-dns-muted">
                      {copy.helperDesc}
                    </div>
                  </div>
                  <ChevronDown
                    className={[
                      'h-4 w-4 shrink-0 text-dns-mid transition-transform',
                      showPromptHelpers ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>

                {showPromptHelpers && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(['it', 'de', 'en'] as const).map(langCode => (
                      <button
                        key={langCode}
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(PROMPT_HELPERS[langCode]);
                          setCopiedHelper(langCode);
                          window.setTimeout(
                            () => setCopiedHelper(current =>
                              current === langCode ? null : current,
                            ),
                            1800,
                          );
                        }}
                        data-dns-press
                        data-dns-hover
                        className="flex items-center justify-between gap-3 rounded-md border border-dns-mid/15 bg-white px-3 py-2 text-left hover:bg-dns-bg"
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[.05em] text-dns-deep">
                            {langCode === 'it'
                              ? 'Italiano'
                              : langCode === 'de'
                                ? 'Deutsch'
                                : 'English'}
                          </div>
                          <div className="mt-0.5 font-alt text-[9px] text-dns-muted">
                            {copiedHelper === langCode ? copy.copied : copy.copyInstruction}
                          </div>
                        </div>
                        {copiedHelper === langCode
                          ? <Check className="h-4 w-4 text-dns-mid" />
                          : <Copy className="h-4 w-4 text-dns-mid" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(promptSuccessMessage || promptErrorMessage) && (
                <div
                  className={[
                    'mt-4 rounded-md border px-3 py-2 font-alt text-[10px]',
                    promptSuccessMessage
                      ? 'border-emerald-700/20 bg-emerald-50 text-emerald-800'
                      : 'border-red-300 bg-red-50 text-red-800',
                  ].join(' ')}
                >
                  {promptSuccessMessage || promptErrorMessage}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleGenerateFromPrompt()}
                  disabled={!promptText.trim()}
                  data-dns-press
                  className="dns-btn-primary min-h-9 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t('btnGenerateFromPrompt', currentLang)}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          <section className="dns-card p-5 md:p-6" data-dns-reveal>
            <div className="flex items-start justify-between gap-4 border-b border-dns-mid/10 pb-4">
              <div>
                <div className="dns-kicker">{copy.detailsKicker}</div>
                <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
                  {t('secDetails', currentLang).replace(/^\d+\.\s*/, '')}
                </h2>
              </div>
              <span className="font-alt text-[9px] uppercase tracking-[.06em] text-dns-muted">
                {copy.required}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="dns-kicker">{t('pollTitleLabel', currentLang)}</span>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={event => {
                    setTitle(event.target.value);
                    setError('');
                  }}
                  placeholder={t('pollTitlePlaceholder', currentLang)}
                  className="dns-input mt-1.5 h-10 w-full"
                  aria-required="true"
                />
              </label>

              <label>
                <span className="flex items-center gap-1.5 dns-kicker">
                  <User className="h-3.5 w-3.5" />
                  {t('organizerLabel', currentLang)}
                </span>
                <input
                  type="text"
                  required
                  list="organizers-list"
                  value={organizerName}
                  onChange={event => {
                    setOrganizerName(event.target.value);
                    setError('');
                  }}
                  placeholder={t('organizerPlaceholder', currentLang)}
                  className="dns-input mt-1.5 h-10 w-full"
                  aria-required="true"
                />
              </label>

              <label>
                <span className="flex items-center gap-1.5 dns-kicker">
                  <Mail className="h-3.5 w-3.5" />
                  {t('organizerEmailLabel', currentLang)}
                </span>
                <input
                  type="email"
                  list="organizer-emails-list"
                  value={organizerEmail}
                  onChange={event => setOrganizerEmail(event.target.value)}
                  placeholder={t('organizerEmailPlaceholder', currentLang)}
                  className="dns-input mt-1.5 h-10 w-full"
                />
              </label>

              <label className="md:col-span-2">
                <span className="flex items-center gap-1.5 dns-kicker">
                  <MapPin className="h-3.5 w-3.5" />
                  {t('locationLabel', currentLang)}
                </span>
                <input
                  type="text"
                  list="locations-list"
                  value={location}
                  onChange={event => setLocation(event.target.value)}
                  placeholder={t('locationPlaceholder', currentLang)}
                  className="dns-input mt-1.5 h-10 w-full"
                />
              </label>

              <label className="md:col-span-2">
                <span className="dns-kicker">{t('descriptionLabel', currentLang)}</span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  placeholder={t('descriptionPlaceholder', currentLang)}
                  className="dns-input mt-1.5 w-full resize-y"
                />
              </label>
            </div>
          </section>

          <section className="dns-card p-5 md:p-6" data-dns-reveal>
            <div className="flex flex-col justify-between gap-3 border-b border-dns-mid/10 pb-4 sm:flex-row sm:items-start">
              <div>
                <div className="dns-kicker">{copy.datesKicker}</div>
                <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
                  {t('secSlots', currentLang).replace(/^\d+\.\s*/, '')}
                </h2>
                <p className="mt-1 font-alt text-[10px] text-dns-muted">
                  {copy.dateHint}
                </p>
              </div>

              {slots.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSlots([])}
                  data-dns-press
                  className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 font-alt text-[10px] font-semibold text-red-700 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {copy.clearAll}
                </button>
              )}
            </div>

            <div className="mt-5 rounded-lg border border-dns-mid/10 bg-dns-bg p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label>
                  <span className="dns-kicker">{t('selectDateLabel', currentLang)}</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={event => {
                      setSelectedDate(event.target.value);
                      setError('');
                    }}
                    className="dns-input mt-1.5 h-10 w-full"
                  />
                </label>

                <label>
                  <span className="dns-kicker">{t('timeSlotLabel', currentLang)}</span>
                  <input
                    type="text"
                    value={customTime}
                    onChange={event => setCustomTime(event.target.value)}
                    placeholder={t('timeSlotPlaceholder', currentLang)}
                    className="dns-input mt-1.5 h-10 w-full"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => handleAddSlot()}
                  data-dns-press
                  className="dns-btn-primary h-10 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  {copy.addOption}
                </button>
              </div>

              <div className="mt-4 border-t border-dns-mid/10 pt-3">
                <div className="dns-kicker">{copy.presets}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    '08:00 - 09:30',
                    '10:00 - 11:30',
                    '14:00 - 15:30',
                    '16:00 - 17:30',
                    t('allDay', currentLang),
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomTime(preset)}
                      data-dns-press
                      className={[
                        'rounded-md border px-2.5 py-1.5 font-alt text-[10px]',
                        customTime === preset
                          ? 'border-dns-mid bg-dns-light text-dns-deep'
                          : 'border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg',
                      ].join(' ')}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {Object.keys(slotsByDate).length === 0 ? (
                <div className="rounded-lg border border-dashed border-dns-mid/20 bg-dns-bg px-5 py-8 text-center font-alt text-[11px] text-dns-muted">
                  <Calendar className="mx-auto mb-2 h-5 w-5 text-dns-light" />
                  {copy.emptySlots}
                </div>
              ) : (
                (Object.entries(slotsByDate) as Array<[string, TimeSlot[]]>).map(([date, dateSlots]) => (
                  <div
                    key={date}
                    className="rounded-lg border border-dns-mid/10 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-dns-mid" />
                        <div>
                          <div className="text-[12px] font-semibold text-dns-deep">
                            {formatDate(date, currentLang).fullFormatted}
                          </div>
                          <div className="mt-0.5 font-alt text-[9px] text-dns-muted">
                            {dateSlots.length} {t('timeSlotsTotal', currentLang)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {dateSlots.map(slot => (
                        <div
                          key={slot.id}
                          className="flex items-center gap-2 rounded-md border border-dns-mid/10 bg-dns-bg px-2.5 py-2"
                        >
                          <Clock className="h-3.5 w-3.5 shrink-0 text-dns-mid" />
                          <input
                            type="text"
                            value={slot.time || ''}
                            onChange={event =>
                              setSlots(current =>
                                current.map(item =>
                                  item.id === slot.id
                                    ? { ...item, time: event.target.value }
                                    : item,
                                ),
                              )
                            }
                            placeholder={t('slotEditTimePlaceholder', currentLang)}
                            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-alt text-[11px] text-dns-deep outline-none"
                            aria-label={copy.editTime}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setSlots(current =>
                                current.filter(item => item.id !== slot.id),
                              )
                            }
                            data-dns-press
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-red-700 hover:border-red-200 hover:bg-red-50"
                            title={copy.removeSlot}
                            aria-label={copy.removeSlot}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="dns-card p-5 md:p-6" data-dns-reveal>
            <div className="dns-kicker">{copy.optionsKicker}</div>
            <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
              {copy.responseMode}
            </h2>

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-dns-mid/10 bg-dns-bg p-4">
              <input
                type="checkbox"
                checked={allowMaybe}
                onChange={event => setAllowMaybe(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-dns-deep"
              />
              <div>
                <div className="text-[11px] font-semibold text-dns-deep">
                  {t('allowMaybeLabel', currentLang)}
                </div>
                <div className="mt-1 font-alt text-[10px] text-dns-muted">
                  {allowMaybe ? copy.yesMaybeNo : copy.yesNo}
                </div>
              </div>
            </label>
          </section>

          <section className="dns-card p-5 md:p-6" data-dns-reveal>
            <div className="flex flex-col justify-between gap-3 border-b border-dns-mid/10 pb-4 sm:flex-row sm:items-start">
              <div>
                <div className="dns-kicker">{copy.recipientsKicker}</div>
                <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
                  {copy.recipientsTitle}
                </h2>
                <p className="mt-1 max-w-2xl font-alt text-[10px] leading-relaxed text-dns-muted">
                  {copy.recipientsHint}
                </p>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dns-mid/15 bg-dns-bg px-2.5 py-1 font-alt text-[9px] font-semibold text-dns-mid">
                <Users className="h-3.5 w-3.5" />
                {recipients.length}
              </span>
            </div>

            <label className="mt-4 block">
              <span className="sr-only">{copy.recipientsTitle}</span>
              <textarea
                rows={6}
                value={recipientInput}
                onChange={event => setRecipientInput(event.target.value)}
                placeholder={copy.recipientsPlaceholder}
                className="dns-input w-full resize-y font-mono text-[10px]"
              />
            </label>

            <div className="mt-2 flex items-center justify-between gap-3 font-alt text-[9px] text-dns-muted">
              <span>{copy.optional}</span>
              <span>
                {recipients.length} {copy.recipientsSummary.toLowerCase()}
              </span>
            </div>

            <div className="mt-4 border-t border-dns-mid/10 pt-4">
              <PrivateRecipientSyncControl currentLang={currentLang} />
            </div>
          </section>

          {error && (
            <div
              className="rounded-md border border-red-300 bg-red-50 px-4 py-3 font-alt text-[11px] font-semibold text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}
        </main>

        <aside className="min-w-0">
          <div className="dns-card p-5 xl:sticky xl:top-[calc(var(--dns-sticky-stack-height)+1.25rem)]" data-dns-reveal>
            <div className="dns-kicker">{copy.summaryKicker}</div>
            <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
              {copy.summaryTitle}
            </h2>

            <div className="mt-5 divide-y divide-dns-mid/10 border-y border-dns-mid/10">
              <div className="flex items-center justify-between gap-3 py-3">
                <span className="font-alt text-[10px] text-dns-muted">
                  {copy.detailsReady}
                </span>
                <span
                  className={[
                    'inline-flex items-center gap-1 text-[10px] font-semibold',
                    detailsReady ? 'text-emerald-800' : 'text-dns-muted',
                  ].join(' ')}
                >
                  {detailsReady && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {detailsReady ? copy.ready : copy.missing}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-3">
                <span className="font-alt text-[10px] text-dns-muted">
                  {copy.datesReady}
                </span>
                <span
                  className={[
                    'text-[10px] font-semibold',
                    datesReady ? 'text-emerald-800' : 'text-dns-muted',
                  ].join(' ')}
                >
                  {datesReady
                    ? `${slots.length} ${t('slotsCount', currentLang)}`
                    : copy.missing}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-3">
                <span className="font-alt text-[10px] text-dns-muted">
                  {copy.responseMode}
                </span>
                <span className="text-right text-[10px] font-semibold text-dns-deep">
                  {allowMaybe ? copy.yesMaybeNo : copy.yesNo}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 py-3">
                <span className="font-alt text-[10px] text-dns-muted">
                  {copy.recipientsSummary}
                </span>
                <span className="text-right text-[10px] font-semibold text-dns-deep">
                  {recipients.length}
                </span>
              </div>
            </div>

            {title.trim() && (
              <div className="mt-4 rounded-lg border border-dns-mid/10 bg-dns-bg p-3">
                <div className="dns-kicker">{copy.summaryKicker}</div>
                <div className="mt-1 text-[12px] font-semibold leading-snug text-dns-deep">
                  {title.trim()}
                </div>
                {(location || organizerName) && (
                  <div className="mt-1 font-alt text-[9px] leading-relaxed text-dns-muted">
                    {[organizerName, location].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              id="create-poll-submit-btn"
              disabled={isSaving}
              data-dns-press
              className="dns-btn-primary mt-5 min-h-10 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? copy.creating : copy.create}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              data-dns-press
              data-dns-hover
              className="dns-btn-secondary mt-2 min-h-9 w-full"
            >
              {copy.cancel}
            </button>

            <p className="mt-4 font-alt text-[9px] leading-relaxed text-dns-muted">
              {detailsReady && datesReady ? copy.ready : copy.formError}
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
};
