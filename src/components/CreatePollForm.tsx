import React, { useState, useMemo } from 'react';
import { Poll, TimeSlot } from '../types';
import { savePollToFirestore } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { getAutocompleteData, saveAutocompleteEntry } from '../utils/autocompleteStore';
import { Calendar, Clock, Plus, Trash2, MapPin, User, Mail, AlignLeft, ArrowRight, Sparkles } from 'lucide-react';

interface CreatePollFormProps {
  onPollCreated: (poll: Poll) => void;
  onCancel: () => void;
  currentLang: Language;
}

export const CreatePollForm: React.FC<CreatePollFormProps> = ({ onPollCreated, onCancel, currentLang }) => {
  // Autocomplete store data
  const autocomplete = useMemo(() => getAutocompleteData(), []);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [organizerEmail, setOrganizerEmail] = useState('');
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

  const handleRemoveSlot = (slotId: string) => {
    setSlots(prev => prev.filter(s => s.id !== slotId));
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
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in space-y-6 font-body">
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
            <span className="text-xs text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-sm border border-slate-300">
              {slots.length} {t('slotsCount', currentLang)}
            </span>
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
                  className="w-full flex items-center justify-center gap-2 bg-dns-primary hover:bg-dns-deep text-white font-bold py-2 px-4 rounded-sm text-xs transition-all shadow-xs"
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
                    className={`text-xs px-2.5 py-1 rounded-sm border transition-colors ${
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

          {/* Added Slots Display List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {t('slotsAddedLabel', currentLang)}
            </h3>

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
                            className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-sm border border-slate-200 text-xs text-slate-800"
                          >
                            <span className="flex items-center gap-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {s.time || t('allDay', currentLang)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(s.id)}
                              className="text-slate-400 hover:text-red-700 p-1 transition-colors"
                              title="Remove"
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
            className="px-4 py-2 rounded-sm border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs transition-colors"
          >
            {t('btnCancel', currentLang)}
          </button>

          <button
            type="submit"
            id="create-poll-submit-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-dns-primary text-white hover:bg-dns-deep font-bold text-xs rounded-sm shadow-xs transition-all"
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
