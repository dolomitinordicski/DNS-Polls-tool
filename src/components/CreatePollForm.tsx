import React, { useState, useMemo } from 'react';
import { Poll, TimeSlot } from '../types';
import { savePollToFirestore } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { getAutocompleteData, saveAutocompleteEntry } from '../utils/autocompleteStore';
import { parsePollPrompt } from '../utils/localPromptParser';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  MapPin, 
  User, 
  Mail, 
  AlignLeft, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  RotateCcw,
  Lightbulb,
  Copy
} from 'lucide-react';

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

export const CreatePollForm: React.FC<CreatePollFormProps> = ({ 
  onPollCreated, 
  onCancel, 
  currentLang,
  initialPromptMode = true
}) => {
  // Autocomplete store data
  const autocomplete = useMemo(() => getAutocompleteData(), []);

  // AI Prompt State
  const [promptText, setPromptText] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptSuccessMessage, setPromptSuccessMessage] = useState('');
  const [promptErrorMessage, setPromptErrorMessage] = useState('');
  const [copiedHelper, setCopiedHelper] = useState<'it' | 'de' | 'en' | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [organizerName, setOrganizerName] = useState('Dolomiti NordicSki');
  const [organizerEmail, setOrganizerEmail] = useState('management@dolomitinordicski.com');
  const [allowMaybe, setAllowMaybe] = useState(true);

  // Dates and slots state
  const [selectedDate, setSelectedDate] = useState('');
  const [customTime, setCustomTime] = useState('09:30 - 11:00');
  const [slots, setSlots] = useState<TimeSlot[]>([
    { id: 'slot-1', date: getFutureDateStr(1), time: '09:30 - 11:00' },
    { id: 'slot-2', date: getFutureDateStr(1), time: '14:30 - 16:00' },
    { id: 'slot-3', date: getFutureDateStr(2), time: '10:00 - 11:30' },
  ]);

  const [error, setError] = useState('');

  // Helper date calculator
  function getFutureDateStr(daysAhead: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  }

  // Parse poll details locally in the browser — no external AI/API calls.
  const handleGenerateFromPrompt = async (textToUse?: string) => {
    const queryPrompt = (textToUse !== undefined ? textToUse : promptText).trim();
    if (!queryPrompt) {
      setPromptErrorMessage(currentLang === 'de' ? 'Bitte geben Sie einen Text ein.' : 'Inserisci un testo per il prompt.');
      return;
    }

    setIsGeneratingPrompt(true);
    setPromptErrorMessage('');
    setPromptSuccessMessage('');

    try {
      const data = parsePollPrompt(queryPrompt, currentLang);

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.location) setLocation(data.location);
      setOrganizerName('Dolomiti NordicSki');
      setOrganizerEmail('management@dolomitinordicski.com');

      if (Array.isArray(data.slots) && data.slots.length > 0) {
        const newSlots: TimeSlot[] = data.slots.map((slot, idx) => ({
          id: `slot-local-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          date: slot.date,
          time: slot.time
        }));
        setSlots(newSlots);
      }

      setPromptSuccessMessage(t('aiPromptSuccess', currentLang));
      setError('');
    } catch (err) {
      console.error('Local prompt parser could not extract poll data:', err);
      setPromptErrorMessage(t('aiPromptError', currentLang));
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleAddSlot = (dateToAdd?: string, timeToAdd?: string) => {
    const targetDate = dateToAdd || selectedDate;
    if (!targetDate) {
      setError(currentLang === 'de' ? 'Bitte wählen Sie ein gültiges Datum aus.' : 'Seleziona una data valida dal calendario.');
      return;
    }
    setError('');
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: targetDate,
      time: timeToAdd || customTime || (currentLang === 'de' ? 'Ganztägig' : 'Tutto il giorno')
    };
    setSlots(prev => [...prev, newSlot]);
  };

  const handleUpdateSlotTime = (slotId: string, newTime: string) => {
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, time: newTime } : s));
  };

  const handleRemoveSlot = (slotId: string) => {
    setSlots(prev => prev.filter(s => s.id !== slotId));
  };

  const handleClearAllSlots = () => {
    setSlots([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError(t('errTitleRequired', currentLang));
      return;
    }
    if (!organizerName.trim()) {
      setError(t('errOrganizerRequired', currentLang));
      return;
    }
    if (slots.length === 0) {
      setError(t('errSlotsRequired', currentLang));
      return;
    }

    // Save entries for future autocompletion
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
      createdAt: new Date().toISOString()
    };

    await savePollToFirestore(newPoll);
    onPollCreated(newPoll);
  };

  // Group slots by date for clean presentation
  const slotsByDate: Record<string, TimeSlot[]> = {};
  slots.forEach(s => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 font-body">
      {/* Autocomplete Datalists */}
      <datalist id="organizers-list">
        {autocomplete.organizers.map((item, idx) => (
          <option key={`org-${idx}`} value={item} />
        ))}
      </datalist>
      <datalist id="organizer-emails-list">
        {autocomplete.organizerEmails.map((item, idx) => (
          <option key={`email-${idx}`} value={item} />
        ))}
      </datalist>
      <datalist id="locations-list">
        {autocomplete.locations.map((item, idx) => (
          <option key={`loc-${idx}`} value={item} />
        ))}
      </datalist>

      {/* Top Banner */}
      <div className="bg-white border border-slate-300 rounded-sm p-6 text-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 text-dns-primary rounded-sm shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#083845]">
              {t('createTitle', currentLang)}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {t('createSubtitle', currentLang)}
            </p>
          </div>
        </div>
      </div>

      {/* Text prompt quick-entry */}
      <div className="bg-white border border-dns-teal/20 rounded-[10px] p-5 shadow-[0_1px_4px_rgba(13,77,94,.06)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-dns-primary/[.06] text-dns-primary rounded-md">
              <AlignLeft className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-extrabold text-sm sm:text-base text-[#083845]">
                  {t('aiPromptTitle', currentLang)}
                </h2>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {t('aiPromptSubtitle', currentLang)}
              </p>
            </div>
          </div>
        </div>

        {/* Text Prompt Input */}
        <div className="space-y-2">
          <textarea
            rows={3}
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              if (promptErrorMessage) setPromptErrorMessage('');
            }}
            placeholder={t('aiPromptPlaceholder', currentLang)}
            className="w-full bg-white border border-slate-300 focus:border-dns-primary rounded-sm p-3 text-slate-900 text-xs sm:text-sm focus:outline-none transition-all placeholder:text-slate-400 shadow-inner"
          />

          {/* Quick Examples */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              {t('aiPromptExamplesLabel', currentLang)}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                t('aiPromptExample1', currentLang),
                t('aiPromptExample2', currentLang),
                t('aiPromptExample3', currentLang),
              ].map((example, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const clean = example.replace(/^[^\w\s]+/, '').trim();
                    setPromptText(clean);
                    handleGenerateFromPrompt(clean);
                  }}
                  className="text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 hover:border-dns-primary rounded-sm px-2.5 py-1 text-left transition-colors cursor-pointer"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Copyable instructions for preparing a DNS Polls prompt with ChatGPT */}
          <div className="mt-3 rounded-sm border border-slate-200 bg-slate-50 p-3 space-y-2.5">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#083845]">
                {currentLang === 'de' ? 'Prompt-Anweisung zum Kopieren' : 'Istruzioni da copiare'}
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {currentLang === 'de'
                  ? 'Eine Sprache kopieren, zusammen mit dem Rohtext an ChatGPT senden und den erzeugten DNS-Prompt hier wieder einfügen.'
                  : 'Copia una lingua, inviala a ChatGPT insieme al testo grezzo e reincolla qui il prompt DNS generato.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {(['it', 'de', 'en'] as const).map((langCode) => (
                <button
                  key={langCode}
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(PROMPT_HELPERS[langCode]);
                    setCopiedHelper(langCode);
                    window.setTimeout(() => setCopiedHelper(current => current === langCode ? null : current), 1800);
                  }}
                  className="flex items-center justify-between gap-2 bg-white hover:bg-slate-100 border border-slate-300 hover:border-dns-primary rounded-sm px-3 py-2 text-left transition-colors"
                >
                  <div>
                    <div className="text-[11px] font-extrabold text-[#083845] uppercase">
                      {langCode === 'it' ? 'Italiano' : langCode === 'de' ? 'Deutsch' : 'English'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {copiedHelper === langCode
                        ? (currentLang === 'de' ? 'Kopiert!' : 'Copiato!')
                        : (currentLang === 'de' ? 'Anweisung kopieren' : 'Copia istruzione')}
                    </div>
                  </div>
                  <Copy className="w-3.5 h-3.5 text-dns-primary shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button & Status Messages */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex-1">
              {promptSuccessMessage && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{promptSuccessMessage}</span>
                </div>
              )}
              {promptErrorMessage && (
                <div className="flex items-center gap-1.5 text-xs text-red-800 bg-red-50 border border-red-300 px-3 py-1.5 rounded-sm font-medium">
                  <span>⚠️</span>
                  <span>{promptErrorMessage}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              id="btn-generate-ai-poll"
              disabled={isGeneratingPrompt || !promptText.trim()}
              onClick={() => handleGenerateFromPrompt()}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-dns-primary hover:bg-dns-deep disabled:bg-slate-300 text-white font-bold text-xs rounded-sm transition-all shadow-xs shrink-0 cursor-pointer"
            >
              {isGeneratingPrompt ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{t('generatingFromPrompt', currentLang)}</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4 text-white" />
                  <span>{t('btnGenerateFromPrompt', currentLang)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Informazioni Generali */}
        <div className="bg-white border border-slate-300 rounded-sm p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h2 className="font-heading font-extrabold text-base text-[#083845] flex items-center gap-2">
              <AlignLeft className="w-5 h-5 text-dns-primary" />
              {t('secDetails', currentLang)}
            </h2>
            <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              {t('required', currentLang)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Title */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('pollTitleLabel', currentLang)}
              </label>
              <input
                type="text"
                required
                placeholder={t('pollTitlePlaceholder', currentLang)}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Organizer Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-600" />
                {t('organizerLabel', currentLang)}
              </label>
              <input
                type="text"
                required
                list="organizers-list"
                placeholder={t('organizerPlaceholder', currentLang)}
                value={organizerName}
                onChange={e => setOrganizerName(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3.5 py-2 text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Organizer Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-600" />
                {t('organizerEmailLabel', currentLang)}
              </label>
              <input
                type="email"
                list="organizer-emails-list"
                placeholder={t('organizerEmailPlaceholder', currentLang)}
                value={organizerEmail}
                onChange={e => setOrganizerEmail(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3.5 py-2 text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Location / Platform */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-600" />
                {t('locationLabel', currentLang)}
              </label>
              <input
                type="text"
                list="locations-list"
                placeholder={t('locationPlaceholder', currentLang)}
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3.5 py-2 text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-500"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('descriptionLabel', currentLang)}
              </label>
              <textarea
                rows={3}
                placeholder={t('descriptionPlaceholder', currentLang)}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3.5 py-2 text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Date & Time Options */}
        <div className="bg-white border border-slate-300 rounded-sm p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h2 className="font-heading font-extrabold text-base text-[#083845] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-dns-primary" />
              {t('secSlots', currentLang)}
            </h2>
            <div className="flex items-center gap-2">
              {slots.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllSlots}
                  className="text-xs text-red-600 hover:text-red-800 hover:underline font-bold px-2 py-1"
                  title={t('clearAllSlots', currentLang)}
                >
                  {t('clearAllSlots', currentLang)}
                </button>
              )}
              <span className="text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-sm border border-slate-300">
                {slots.length} {t('slotsCount', currentLang)}
              </span>
            </div>
          </div>

          {/* Quick Date Picker Controls */}
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t('selectDateLabel', currentLang)}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3 py-2 text-slate-900 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  {t('timeSlotLabel', currentLang)}
                </label>
                <input
                  type="text"
                  placeholder={t('timeSlotPlaceholder', currentLang)}
                  value={customTime}
                  onChange={e => setCustomTime(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3 py-2 text-slate-900 text-xs focus:outline-none placeholder:text-slate-500"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => handleAddSlot()}
                  className="w-full flex items-center justify-center gap-2 bg-dns-primary hover:bg-dns-deep text-white font-bold py-2 px-4 rounded-sm text-xs transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  {t('btnAddDate', currentLang)}
                </button>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-600 font-bold mr-2">{t('quickTimeShortcuts', currentLang)}</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  '09:00 - 10:30',
                  '11:00 - 12:30',
                  '14:30 - 16:00',
                  '17:00 - 18:30',
                  t('allDay', currentLang)
                ].map((timePreset) => (
                  <button
                    key={timePreset}
                    type="button"
                    onClick={() => setCustomTime(timePreset)}
                    className={`text-xs px-2.5 py-1 rounded-sm border transition-colors cursor-pointer ${
                      customTime === timePreset
                        ? 'bg-dns-primary text-white border-dns-primary font-bold'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-dns-primary'
                    }`}
                  >
                    {timePreset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Added Slots Display List with Inline Time Editing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {t('slotsAddedLabel', currentLang)}
              </h3>
              {slots.length > 0 && (
                <span className="text-[11px] text-slate-500 italic">
                  {currentLang === 'de' ? 'Tipp: Sie können jede Uhrzeit direkt im Textfeld bearbeiten' : 'Nota: Puoi modificare qualsiasi orario direttamente nel riquadro'}
                </span>
              )}
            </div>

            {Object.keys(slotsByDate).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-sm text-slate-500 text-xs">
                {t('noSlotsAdded', currentLang)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(slotsByDate).map(([dateStr, dateSlots]) => {
                  const parts = dateStr.split('-');
                  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
                  
                  return (
                    <div 
                      key={dateStr}
                      className="bg-slate-50 border border-slate-200 rounded-sm p-3 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-heading font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-dns-primary" />
                          {formattedDate}
                        </span>
                        <span className="text-[10px] text-slate-600 font-mono bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">
                          {dateSlots.length} {t('timeSlotsTotal', currentLang)}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {dateSlots.map((s) => (
                          <div 
                            key={s.id}
                            className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-sm border border-slate-200 text-xs text-slate-800 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Clock className="w-3.5 h-3.5 text-dns-primary shrink-0" />
                              <input
                                type="text"
                                value={s.time || ''}
                                onChange={(e) => handleUpdateSlotTime(s.id, e.target.value)}
                                placeholder={t('slotEditTimePlaceholder', currentLang)}
                                className="bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-dns-primary rounded px-1.5 py-0.5 text-xs text-slate-800 w-full focus:outline-none transition-colors font-medium"
                                title={currentLang === 'de' ? 'Uhrzeit direkt bearbeiten' : 'Modifica orario direttamente'}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(s.id)}
                              className="text-slate-400 hover:text-red-700 p-1 transition-colors shrink-0 cursor-pointer"
                              title={currentLang === 'de' ? 'Termin entfernen' : 'Rimuovi orario'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Allow Maybe Checkbox */}
          <div className="pt-2 border-t border-slate-200">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allowMaybe}
                onChange={e => setAllowMaybe(e.target.checked)}
                className="w-4 h-4 accent-dns-primary rounded-sm"
              />
              <span className="text-xs text-slate-700 font-medium">
                {t('allowMaybeLabel', currentLang)}
              </span>
            </label>
          </div>
        </div>

        {/* Error Alert if any */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-300 rounded-sm text-red-800 text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-sm border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
          >
            {t('btnCancel', currentLang)}
          </button>

          <button
            type="submit"
            id="create-poll-submit-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-dns-primary text-white hover:bg-dns-deep font-bold text-xs rounded-sm shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>{t('btnCreateSubmit', currentLang)}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
