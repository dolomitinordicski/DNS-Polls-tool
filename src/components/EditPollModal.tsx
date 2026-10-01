import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlignLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Plus,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Poll, TimeSlot } from '../types';
import { savePollToFirestore } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import {
  getAutocompleteData,
  saveAutocompleteEntry,
} from '../utils/autocompleteStore';
import { useAccessibleDialog } from '../lib/useAccessibleDialog';

interface EditPollModalProps {
  poll: Poll;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPoll: Poll) => void;
  currentLang: Language;
}

export const EditPollModal: React.FC<EditPollModalProps> = ({
  poll,
  isOpen,
  onClose,
  onSave,
  currentLang,
}) => {
  const dialogRef = useRef<HTMLElement>(null);
  const autocomplete = useMemo(() => getAutocompleteData(), []);

  const [title, setTitle] = useState(poll.title);
  const [description, setDescription] = useState(poll.description || '');
  const [organizerName, setOrganizerName] = useState(poll.organizerName);
  const [organizerEmail, setOrganizerEmail] = useState(poll.organizerEmail || '');
  const [location, setLocation] = useState(poll.location || '');
  const [allowMaybe, setAllowMaybe] = useState(poll.allowMaybe);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useAccessibleDialog({
    isOpen,
    onClose: () => {
      if (!isSaving) onClose();
    },
    dialogRef,
    initialFocusSelector: '#edit-poll-title',
  });

  useEffect(() => {
    if (!isOpen) return;

    setTitle(poll.title);
    setDescription(poll.description || '');
    setOrganizerName(poll.organizerName);
    setOrganizerEmail(poll.organizerEmail || '');
    setLocation(poll.location || '');
    setAllowMaybe(poll.allowMaybe);
    setSlots(poll.slots ? poll.slots.map(slot => ({ ...slot })) : []);
    setNewDate('');
    setNewTime('');
    setErrorMsg('');
    setSuccessMsg(false);
    setIsSaving(false);
  }, [isOpen, poll]);

  if (!isOpen) return null;

  const copy = currentLang === 'de'
    ? {
        details: 'Umfragedetails',
        slots: 'Termine',
        addSlot: 'Termin hinzufügen',
        allowMaybe: 'Antwort „Falls nötig“ erlauben',
        cancel: 'Abbrechen',
        close: 'Dialog schließen',
        minSlot: 'Mindestens ein Termin ist erforderlich.',
        selectDate: 'Bitte wählen Sie ein Datum aus.',
        titleRequired: 'Titel ist erforderlich.',
        organizerRequired: 'Organisator ist erforderlich.',
        saveError: 'Die Änderungen konnten nicht gespeichert werden.',
        removeSlot: 'Termin löschen',
      }
    : {
        details: 'Dettagli sondaggio',
        slots: 'Date e orari',
        addSlot: 'Aggiungi data',
        allowMaybe: 'Consenti la risposta “Se necessario”',
        cancel: 'Annulla',
        close: 'Chiudi finestra',
        minSlot: 'È necessario mantenere almeno una data.',
        selectDate: 'Seleziona una data.',
        titleRequired: 'Il titolo del sondaggio è obbligatorio.',
        organizerRequired: 'L’organizzatore è obbligatorio.',
        saveError: 'Impossibile salvare le modifiche.',
        removeSlot: 'Elimina data',
      };

  const handleSlotDateChange = (id: string, date: string) => {
    setSlots(current =>
      current.map(slot => slot.id === id ? { ...slot, date } : slot),
    );
  };

  const handleSlotTimeChange = (id: string, time: string) => {
    setSlots(current =>
      current.map(slot => slot.id === id ? { ...slot, time } : slot),
    );
  };

  const handleRemoveSlot = (id: string) => {
    if (slots.length <= 1) {
      setErrorMsg(copy.minSlot);
      return;
    }

    setErrorMsg('');
    setSlots(current => current.filter(slot => slot.id !== id));
  };

  const handleAddSlot = () => {
    if (!newDate) {
      setErrorMsg(copy.selectDate);
      return;
    }

    const slot: TimeSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: newDate,
      time: newTime.trim() || t('allDay', currentLang),
    };

    setSlots(current => [...current, slot]);
    setNewDate('');
    setNewTime('');
    setErrorMsg('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      setErrorMsg(copy.titleRequired);
      return;
    }

    if (!organizerName.trim()) {
      setErrorMsg(copy.organizerRequired);
      return;
    }

    if (slots.length === 0) {
      setErrorMsg(copy.minSlot);
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    saveAutocompleteEntry('organizers', organizerName);
    if (organizerEmail) {
      saveAutocompleteEntry('organizerEmails', organizerEmail);
    }
    if (location) {
      saveAutocompleteEntry('locations', location);
    }

    const sortedSlots = [...slots].sort((a, b) => {
      const dateOrder = a.date.localeCompare(b.date);
      return dateOrder !== 0
        ? dateOrder
        : (a.time || '').localeCompare(b.time || '');
    });

    const finalizedSlotStillExists =
      !poll.finalizedSlotId ||
      sortedSlots.some(slot => slot.id === poll.finalizedSlotId);

    const updatedPoll: Poll = {
      ...poll,
      title: title.trim(),
      description: description.trim() || undefined,
      organizerName: organizerName.trim(),
      organizerEmail: organizerEmail.trim() || undefined,
      location: location.trim() || undefined,
      allowMaybe,
      slots: sortedSlots,
      finalizedSlotId: finalizedSlotStillExists
        ? poll.finalizedSlotId
        : undefined,
    };

    try {
      await savePollToFirestore(updatedPoll);
      onSave(updatedPoll);
      setSuccessMsg(true);
      window.setTimeout(onClose, 700);
    } catch (error) {
      console.error('Error updating poll:', error);
      setErrorMsg(copy.saveError);
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dns-deep/55 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={event => {
        if (event.currentTarget === event.target && !isSaving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-poll-modal-title"
        aria-describedby="edit-poll-modal-description"
        tabIndex={-1}
        className="dns-card flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden outline-none"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-dns-mid/10 bg-dns-primary px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-alt text-[9px] font-bold uppercase tracking-[.07em] text-dns-soft">
              <Calendar className="h-3.5 w-3.5" />
              {copy.details}
            </div>
            <h2
              id="edit-poll-modal-title"
              className="mt-1 text-[18px] font-semibold text-white"
            >
              {t('editPollModalTitle', currentLang)}
            </h2>
            <p
              id="edit-poll-modal-description"
              className="mt-1 font-alt text-[9px] text-white/70"
            >
              {poll.title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            data-dns-press
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label={copy.close}
            title={copy.close}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <div className="space-y-6">
              <div aria-live="polite">
                {errorMsg && (
                  <div
                    className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 font-alt text-[10px] font-semibold text-red-800"
                    role="alert"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 font-alt text-[10px] font-semibold text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{t('editPollSuccess', currentLang)}</span>
                  </div>
                )}
              </div>

              <section>
                <div className="dns-kicker">{copy.details}</div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="dns-kicker">
                      {t('pollTitleLabel', currentLang)}
                    </span>
                    <input
                      id="edit-poll-title"
                      type="text"
                      required
                      value={title}
                      onChange={event => setTitle(event.target.value)}
                      className="dns-input mt-1.5 h-10 w-full"
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
                      list="edit-organizers-list"
                      value={organizerName}
                      onChange={event => setOrganizerName(event.target.value)}
                      className="dns-input mt-1.5 h-10 w-full"
                    />
                  </label>

                  <label>
                    <span className="flex items-center gap-1.5 dns-kicker">
                      <Mail className="h-3.5 w-3.5" />
                      {t('organizerEmailLabel', currentLang)}
                    </span>
                    <input
                      type="email"
                      list="edit-emails-list"
                      value={organizerEmail}
                      onChange={event => setOrganizerEmail(event.target.value)}
                      className="dns-input mt-1.5 h-10 w-full"
                    />
                  </label>

                  <label>
                    <span className="flex items-center gap-1.5 dns-kicker">
                      <MapPin className="h-3.5 w-3.5" />
                      {t('locationLabel', currentLang)}
                    </span>
                    <input
                      type="text"
                      list="edit-locations-list"
                      value={location}
                      onChange={event => setLocation(event.target.value)}
                      className="dns-input mt-1.5 h-10 w-full"
                    />
                  </label>

                  <label className="flex min-h-10 items-center gap-2 self-end rounded-md border border-dns-mid/10 bg-dns-bg px-3 py-2 font-alt text-[10px] font-semibold text-dns-deep">
                    <input
                      type="checkbox"
                      checked={allowMaybe}
                      onChange={event => setAllowMaybe(event.target.checked)}
                      className="h-4 w-4 accent-dns-mid"
                    />
                    <span>{copy.allowMaybe}</span>
                  </label>

                  <label className="sm:col-span-2">
                    <span className="flex items-center gap-1.5 dns-kicker">
                      <AlignLeft className="h-3.5 w-3.5" />
                      {t('descriptionLabel', currentLang)}
                    </span>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={event => setDescription(event.target.value)}
                      className="dns-input mt-1.5 w-full resize-y"
                    />
                  </label>
                </div>
              </section>

              <section className="border-t border-dns-mid/10 pt-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="dns-kicker">{copy.slots}</div>
                    <div className="mt-1 font-alt text-[9px] text-dns-muted">
                      {slots.length} {t('slotsCount', currentLang)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {slots.map((slot, index) => (
                    <div
                      key={slot.id}
                      className="grid gap-2 rounded-lg border border-dns-mid/10 bg-dns-bg p-3 sm:grid-cols-[auto_160px_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <span className="font-alt text-[9px] font-bold text-dns-muted">
                        #{index + 1}
                      </span>

                      <label>
                        <span className="sr-only">
                          {t('selectDateLabel', currentLang)}
                        </span>
                        <input
                          type="date"
                          required
                          value={slot.date}
                          onChange={event =>
                            handleSlotDateChange(slot.id, event.target.value)
                          }
                          className="dns-input h-9 w-full"
                        />
                      </label>

                      <label>
                        <span className="sr-only">
                          {t('timeSlotLabel', currentLang)}
                        </span>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dns-muted" />
                          <input
                            type="text"
                            value={slot.time || ''}
                            placeholder={t('timeSlotPlaceholder', currentLang)}
                            onChange={event =>
                              handleSlotTimeChange(slot.id, event.target.value)
                            }
                            className="dns-input h-9 w-full pl-8"
                          />
                        </div>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(slot.id)}
                        data-dns-press
                        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 sm:w-9"
                        aria-label={`${copy.removeSlot} #${index + 1}`}
                        title={copy.removeSlot}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-lg border border-dashed border-dns-mid/20 bg-dns-light/10 p-3">
                  <div className="dns-kicker">{copy.addSlot}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                    <label>
                      <span className="sr-only">
                        {t('selectDateLabel', currentLang)}
                      </span>
                      <input
                        type="date"
                        value={newDate}
                        onChange={event => setNewDate(event.target.value)}
                        className="dns-input h-9 w-full"
                      />
                    </label>

                    <label>
                      <span className="sr-only">
                        {t('timeSlotLabel', currentLang)}
                      </span>
                      <input
                        type="text"
                        value={newTime}
                        placeholder={t('timeSlotPlaceholder', currentLang)}
                        onChange={event => setNewTime(event.target.value)}
                        className="dns-input h-9 w-full"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleAddSlot}
                      data-dns-press
                      className="dns-btn-secondary min-h-9"
                    >
                      <Plus className="h-4 w-4" />
                      {t('btnAddDate', currentLang)}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <datalist id="edit-organizers-list">
              {autocomplete.organizers.map((value, index) => (
                <option key={`edit-organizer-${index}`} value={value} />
              ))}
            </datalist>
            <datalist id="edit-emails-list">
              {autocomplete.organizerEmails.map((value, index) => (
                <option key={`edit-email-${index}`} value={value} />
              ))}
            </datalist>
            <datalist id="edit-locations-list">
              {autocomplete.locations.map((value, index) => (
                <option key={`edit-location-${index}`} value={value} />
              ))}
            </datalist>
          </div>

          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-dns-mid/10 bg-dns-bg px-5 py-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              data-dns-press
              className="dns-btn-secondary min-h-10 disabled:opacity-50"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              data-dns-press
              className="dns-btn-primary min-h-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving
                ? (currentLang === 'de' ? 'Speichert…' : 'Salvataggio…')
                : t('btnSaveEdits', currentLang)}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};
