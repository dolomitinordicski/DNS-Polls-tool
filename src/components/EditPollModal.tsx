import React, { useState, useEffect, useMemo } from 'react';
import { Poll, TimeSlot } from '../types';
import { savePollToFirestore } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { getAutocompleteData, saveAutocompleteEntry } from '../utils/autocompleteStore';
import { 
  X, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  User, 
  Mail, 
  AlignLeft 
} from 'lucide-react';

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
  currentLang
}) => {
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

  // Sync state when poll changes
  useEffect(() => {
    if (poll) {
      setTitle(poll.title);
      setDescription(poll.description || '');
      setOrganizerName(poll.organizerName);
      setOrganizerEmail(poll.organizerEmail || '');
      setLocation(poll.location || '');
      setAllowMaybe(poll.allowMaybe);
      setSlots(poll.slots ? JSON.parse(JSON.stringify(poll.slots)) : []);
      setErrorMsg('');
      setSuccessMsg(false);
    }
  }, [poll, isOpen]);

  if (!isOpen) return null;

  const handleSlotDateChange = (id: string, dateVal: string) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, date: dateVal } : s));
  };

  const handleSlotTimeChange = (id: string, timeVal: string) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, time: timeVal } : s));
  };

  const handleRemoveSlot = (id: string) => {
    if (slots.length <= 1) {
      setErrorMsg(currentLang === 'de' ? 'Mindestens ein Termin ist erforderlich.' : 'È necessario mantenere almeno un orario/data.');
      return;
    }
    setErrorMsg('');
    setSlots(prev => prev.filter(s => s.id !== id));
  };

  const handleAddSlot = () => {
    if (!newDate) {
      setErrorMsg(currentLang === 'de' ? 'Bitte wählen Sie ein Datum aus.' : 'Seleziona una data per aggiungere il nuovo orario.');
      return;
    }
    setErrorMsg('');
    const newSlotItem: TimeSlot = {
      id: `slot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: newDate,
      time: newTime.trim() || t('allDay', currentLang)
    };
    setSlots(prev => [...prev, newSlotItem]);
    setNewTime('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(currentLang === 'de' ? 'Titel ist erforderlich.' : 'Il titolo del sondaggio è obbligatorio.');
      return;
    }
    if (!organizerName.trim()) {
      setErrorMsg(t('errEnterName', currentLang));
      return;
    }
    if (slots.length === 0) {
      setErrorMsg(currentLang === 'de' ? 'Fügen Sie mindestens einen Termin hinzu.' : 'Inserisci almeno un opzione di data e orario.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    // Save autocompletions
    saveAutocompleteEntry('organizers', organizerName);
    if (organizerEmail) saveAutocompleteEntry('organizerEmails', organizerEmail);
    if (location) saveAutocompleteEntry('locations', location);

    const updatedPoll: Poll = {
      ...poll,
      title: title.trim(),
      description: description.trim() || undefined,
      organizerName: organizerName.trim(),
      organizerEmail: organizerEmail.trim() || undefined,
      location: location.trim() || undefined,
      allowMaybe,
      slots: slots.sort((a, b) => a.date.localeCompare(b.date))
    };

    try {
      await savePollToFirestore(updatedPoll);
      onSave(updatedPoll);
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        setIsSaving(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Error updating poll:', err);
      setErrorMsg('Errore nel salvataggio delle modifiche.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-body overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-sm shadow-2xl w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#083845] text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-dns-teal" />
            <h2 className="font-heading font-extrabold text-lg sm:text-xl">
              {t('editPollModalTitle', currentLang)}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-sm text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto grow">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-sm text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-sm text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('editPollSuccess', currentLang)}</span>
            </div>
          )}

          {/* Section 1: Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-dns-primary border-b border-slate-200 pb-1.5">
              {t('secDetails', currentLang)}
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {t('pollTitleLabel', currentLang)}
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-dns-primary focus:bg-white rounded-sm text-sm outline-hidden text-slate-800 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-dns-primary" />
                  {t('organizerLabel', currentLang)}
                </label>
                <input
                  type="text"
                  required
                  list="edit-organizers-list"
                  value={organizerName}
                  onChange={e => setOrganizerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-dns-primary focus:bg-white rounded-sm text-sm outline-hidden text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-dns-primary" />
                  {t('organizerEmailLabel', currentLang)}
                </label>
                <input
                  type="email"
                  list="edit-emails-list"
                  value={organizerEmail}
                  onChange={e => setOrganizerEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-dns-primary focus:bg-white rounded-sm text-sm outline-hidden text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-dns-primary" />
                  {t('locationLabel', currentLang)}
                </label>
                <input
                  type="text"
                  list="edit-locations-list"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-dns-primary focus:bg-white rounded-sm text-sm outline-hidden text-slate-800"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowMaybe}
                    onChange={e => setAllowMaybe(e.target.checked)}
                    className="w-4 h-4 text-dns-primary border-slate-300 rounded-xs focus:ring-dns-primary"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    {t('allowMaybeLabel', currentLang)}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                <AlignLeft className="w-3.5 h-3.5 text-dns-primary" />
                {t('descriptionLabel', currentLang)}
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:border-dns-primary focus:bg-white rounded-sm text-sm outline-hidden text-slate-800"
              />
            </div>
          </div>

          {/* Section 2: Manage Date Slots */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-dns-primary border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>{t('secSlots', currentLang)} ({slots.length})</span>
            </h3>

            {/* List of existing slots */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {slots.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-300 rounded-sm">
                  <span className="text-xs font-mono font-bold text-slate-400 w-5 shrink-0">#{idx+1}</span>
                  <input
                    type="date"
                    required
                    value={s.date}
                    onChange={e => handleSlotDateChange(s.id, e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 text-xs font-semibold rounded-sm text-slate-800 focus:border-dns-primary outline-hidden"
                  />
                  <input
                    type="text"
                    value={s.time || ''}
                    placeholder={t('timeSlotPlaceholder', currentLang)}
                    onChange={e => handleSlotTimeChange(s.id, e.target.value)}
                    className="grow px-2.5 py-1.5 bg-white border border-slate-300 text-xs rounded-sm text-slate-800 focus:border-dns-primary outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(s.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                    title={t('btnDelete', currentLang)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Slot Box */}
            <div className="p-3 bg-slate-100/80 border border-dashed border-slate-300 rounded-sm space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                {t('addDateSlot', currentLang)}:
              </span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 text-xs font-semibold rounded-sm text-slate-800 focus:border-dns-primary outline-hidden"
                />
                <input
                  type="text"
                  value={newTime}
                  placeholder={t('timeSlotPlaceholder', currentLang)}
                  onChange={e => setNewTime(e.target.value)}
                  className="grow px-2.5 py-1.5 bg-white border border-slate-300 text-xs rounded-sm text-slate-800 focus:border-dns-primary outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-dns-teal text-white hover:bg-dns-teal/90 text-xs font-bold rounded-sm transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('btnAddDate', currentLang)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hidden datalists for autocompletion */}
          <datalist id="edit-organizers-list">
            {autocomplete.organizers.map((o, i) => <option key={`e-org-${i}`} value={o} />)}
          </datalist>
          <datalist id="edit-emails-list">
            {autocomplete.organizerEmails.map((e, i) => <option key={`e-em-${i}`} value={e} />)}
          </datalist>
          <datalist id="edit-locations-list">
            {autocomplete.locations.map((l, i) => <option key={`e-loc-${i}`} value={l} />)}
          </datalist>

          {/* Submit Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-sm transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 bg-dns-primary text-white hover:bg-dns-deep font-bold text-xs rounded-sm shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{t('btnSaveEdits', currentLang)}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
