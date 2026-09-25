import React, { useState, useMemo } from 'react';
import { Poll, TimeSlot } from '../types';
import { formatDate, getSlotVoteSummary, getTopVotedSlot } from '../utils/dateUtils';
import { Language, t } from '../utils/i18n';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Trophy, 
  CheckCircle2, 
  Filter, 
  X, 
  ArrowRight
} from 'lucide-react';

interface PollCalendarViewProps {
  polls: Poll[];
  selectedPollId?: string;
  onSelectPoll: (poll: Poll) => void;
  onNavigateToVote?: (poll: Poll, slotId?: string) => void;
  currentLang?: Language;
}

interface CalendarEvent {
  poll: Poll;
  slot: TimeSlot;
  isTopSlot: boolean;
  isFinalized: boolean;
  summary: { yes: number; maybe: number; no: number; score: number };
}

export const PollCalendarView: React.FC<PollCalendarViewProps> = ({
  polls,
  selectedPollId,
  onSelectPoll,
  onNavigateToVote,
  currentLang = 'de'
}) => {
  // Determine initial month/year from active polls or current date
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (polls.length > 0) {
      for (const p of polls) {
        if (p.slots.length > 0) {
          const [y, m] = p.slots[0].date.split('-').map(Number);
          if (y && m) return new Date(y, m - 1, 1);
        }
      }
    }
    return new Date();
  });

  const [activePollFilter, setActivePollFilter] = useState<string>(selectedPollId || 'all');
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ dateStr: string; events: CalendarEvent[] } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const filteredPolls = useMemo(() => {
    if (activePollFilter === 'all') return polls;
    return polls.filter(p => p.id === activePollFilter);
  }, [polls, activePollFilter]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    filteredPolls.forEach(poll => {
      const topSlotId = getTopVotedSlot(poll.slots, poll.participants);

      poll.slots.forEach(slot => {
        if (!slot.date) return;
        const summary = getSlotVoteSummary(slot.id, poll.participants);
        const isTopSlot = slot.id === topSlotId;
        const isFinalized = poll.finalizedSlotId === slot.id;

        const event: CalendarEvent = {
          poll,
          slot,
          isTopSlot,
          isFinalized,
          summary
        };

        if (!map[slot.date]) {
          map[slot.date] = [];
        }
        map[slot.date].push(event);
      });
    });

    return map;
  }, [filteredPolls]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const calendarGrid = useMemo(() => {
    const firstDayInstance = new Date(year, month, 1);
    const lastDayInstance = new Date(year, month + 1, 0);

    const daysInMonth = lastDayInstance.getDate();
    let startDayOfWeek = firstDayInstance.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - startDayOfWeek + 1;
      const cellDate = new Date(year, month, dayOffset);
      
      const yStr = cellDate.getFullYear();
      const mStr = String(cellDate.getMonth() + 1).padStart(2, '0');
      const dStr = String(cellDate.getDate()).padStart(2, '0');
      const dateStr = `${yStr}-${mStr}-${dStr}`;

      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = dateStr === todayStr;

      days.push({
        dateStr,
        dayNumber: cellDate.getDate(),
        isCurrentMonth,
        isToday
      });
    }

    return days;
  }, [year, month]);

  const monthNames = currentLang === 'de'
    ? ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    : ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  const weekdayNames = currentLang === 'de'
    ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    : ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="space-y-6 animate-fade-in font-body">
      {/* Top Header Controls Bar */}
      <div className="bg-white border border-slate-300 rounded-sm p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Month Title & Navigation */}
        <div className="flex items-center gap-3 justify-between md:justify-start">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrevMonth}
              id="cal-prev-month-btn"
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-sm border border-slate-300 transition-all"
              title="Vorheriger Monat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              id="cal-today-btn"
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-sm border border-slate-300 transition-all"
            >
              {t('calToday', currentLang)}
            </button>
            <button
              onClick={handleNextMonth}
              id="cal-next-month-btn"
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-sm border border-slate-300 transition-all"
              title="Nächster Monat"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="font-heading font-extrabold text-xl text-[#083845] tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-dns-primary" />
            <span>{monthNames[month]} {year}</span>
          </h2>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <span className="text-xs text-slate-700 font-semibold hidden sm:inline">{t('calFilterPoll', currentLang)}:</span>
          <select
            value={activePollFilter}
            onChange={(e) => setActivePollFilter(e.target.value)}
            id="cal-poll-filter-select"
            className="w-full sm:w-64 bg-slate-100 border border-slate-300 focus:border-dns-primary text-slate-900 text-xs font-medium rounded-sm px-3 py-1.5 focus:outline-none"
          >
            <option value="all">{t('calAllPolls', currentLang)} ({polls.length})</option>
            {polls.map(p => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.slots.length} {currentLang === 'de' ? 'Termine' : 'date'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend & Summary Info Bar */}
      <div className="bg-white border border-slate-300 rounded-sm p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-600">{t('calLegend', currentLang)}:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>{t('legendAvailable', currentLang)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>{t('legendIfNeeded', currentLang)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-600 inline" />
            <span>{t('legendTopVoted', currentLang)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
            <span>{t('legendConfirmed', currentLang)}</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          {t('calClickDayNote', currentLang)}
        </div>
      </div>

      {/* Main Calendar Grid */}
      <div className="bg-white border border-slate-300 rounded-sm overflow-hidden shadow-xs">
        {/* Weekday Columns Header */}
        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-300 text-center py-2 font-heading text-xs font-bold text-slate-700 uppercase tracking-wider">
          {weekdayNames.map((dayName, idx) => (
            <div key={dayName} className={idx >= 5 ? 'text-slate-500' : ''}>
              {dayName}
            </div>
          ))}
        </div>

        {/* Days Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-white">
          {calendarGrid.map((dayItem) => {
            const dayEvents = eventsByDate[dayItem.dateStr] || [];
            const hasEvents = dayEvents.length > 0;
            const hasTopSlot = dayEvents.some(e => e.isTopSlot);
            const hasFinalized = dayEvents.some(e => e.isFinalized);

            return (
              <div
                key={dayItem.dateStr}
                onClick={() => {
                  if (hasEvents) {
                    setSelectedDayEvents({ dateStr: dayItem.dateStr, events: dayEvents });
                  }
                }}
                className={`min-h-[105px] sm:min-h-[120px] p-2 flex flex-col justify-between transition-all relative ${
                  !dayItem.isCurrentMonth ? 'bg-slate-50 text-slate-400 opacity-50' : 'hover:bg-slate-50'
                } ${dayItem.isToday ? 'ring-2 ring-dns-primary ring-inset bg-slate-50' : ''} ${
                  hasEvents ? 'cursor-pointer' : ''
                } ${hasFinalized ? 'bg-emerald-50/60' : hasTopSlot ? 'bg-amber-50/60' : ''}`}
              >
                {/* Day Header Row */}
                <div className="flex items-center justify-between">
                  <span
                    className={`font-heading text-xs font-bold rounded-sm w-5 h-5 flex items-center justify-center ${
                      dayItem.isToday
                        ? 'bg-dns-primary text-white font-extrabold'
                        : dayItem.isCurrentMonth
                        ? 'text-slate-900'
                        : 'text-slate-400'
                    }`}
                  >
                    {dayItem.dayNumber}
                  </span>

                  {hasFinalized && (
                    <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-1 py-0.2 rounded-sm flex items-center gap-0.5" title="Confirmed">
                      <CheckCircle2 className="w-3 h-3" />
                      <span className="hidden sm:inline">OK</span>
                    </span>
                  )}
                  {!hasFinalized && hasTopSlot && (
                    <span className="text-[10px] bg-amber-100 border border-amber-300 text-amber-900 font-bold px-1 py-0.2 rounded-sm flex items-center gap-0.5" title="Top option">
                      <Trophy className="w-3 h-3 text-amber-700" />
                    </span>
                  )}
                </div>

                {/* Day Slots & Badges Container */}
                <div className="space-y-1 my-1 flex-1">
                  {dayEvents.slice(0, 3).map((evt, idx) => {
                    return (
                      <div
                        key={`${evt.poll.id}-${evt.slot.id}-${idx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPoll(evt.poll);
                        }}
                        className={`group p-1 rounded-sm border text-[11px] leading-tight transition-all cursor-pointer ${
                          evt.isFinalized
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold'
                            : evt.isTopSlot
                            ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                            : 'bg-slate-100 border-slate-200 text-slate-800 hover:border-dns-primary'
                        }`}
                        title={`${evt.poll.title} (${evt.slot.time || t('allDay', currentLang)}) - ${evt.summary.yes} Yes`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-heading font-bold truncate max-w-[90px] text-slate-900">
                            {evt.poll.title}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold shrink-0">
                            {evt.summary.yes}✓
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-600 mt-0.5 font-mono">
                          <span className="truncate">
                            <Clock className="w-2.5 h-2.5 inline mr-0.5 text-slate-500" />
                            {evt.slot.time || t('allDay', currentLang)}
                          </span>
                          {evt.isTopSlot && !evt.isFinalized && (
                            <span className="text-amber-700 font-bold">🏆</span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {dayEvents.length > 3 && (
                    <div className="text-[10px] font-bold text-slate-600 text-center py-0.5 bg-slate-100 rounded-sm border border-slate-200">
                      +{dayEvents.length - 3} {currentLang === 'de' ? 'weitere' : 'altri'}
                    </div>
                  )}
                </div>

                {/* Bottom indicators */}
                {hasEvents && (
                  <div className="text-[10px] text-slate-500 font-mono text-right pt-0.5">
                    {dayEvents.length} {currentLang === 'de' ? 'Option(en)' : 'opzioni'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Quick Details Modal */}
      {selectedDayEvents && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-body"
          onClick={() => setSelectedDayEvents(null)}
        >
          <div 
            className="bg-white border border-slate-300 rounded-sm max-w-lg w-full p-5 space-y-4 shadow-xl text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-dns-primary" />
                <h3 className="font-heading font-extrabold text-base text-[#083845]">
                  {currentLang === 'de' ? 'Termindetails für ' : 'Dettaglio Date del '} {formatDate(selectedDayEvents.dateStr, currentLang).fullFormatted}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-sm hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of events on this day */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDayEvents.events.map((evt) => {
                return (
                  <div 
                    key={`${evt.poll.id}-${evt.slot.id}`}
                    className="bg-slate-50 border border-slate-200 rounded-sm p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-heading font-bold text-sm text-[#083845]">
                            {evt.poll.title}
                          </h4>
                          {evt.isFinalized && (
                            <span className="text-[10px] uppercase font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-sm flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {t('dateConfirmedBadge', currentLang)}
                            </span>
                          )}
                          {!evt.isFinalized && evt.isTopSlot && (
                            <span className="text-[10px] uppercase font-extrabold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-sm flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-amber-700" /> {t('topVotedBadge', currentLang)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {t('organizer', currentLang)} <strong className="text-slate-800">{evt.poll.organizerName}</strong>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="inline-block text-xs font-mono font-bold bg-white px-2 py-1 rounded-sm border border-slate-200 text-slate-800">
                          <Clock className="w-3 h-3 inline mr-1 text-slate-500" />
                          {evt.slot.time || t('allDay', currentLang)}
                        </span>
                      </div>
                    </div>

                    {/* Votes breakdown */}
                    <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-sm text-center text-xs border border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">{t('legendAvailable', currentLang)}</span>
                        <strong className="text-sm text-emerald-800">{evt.summary.yes}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 uppercase block">{t('legendIfNeeded', currentLang)}</span>
                        <strong className="text-sm text-amber-800">{evt.summary.maybe}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-red-700 uppercase block">{currentLang === 'de' ? 'Nein' : 'No'}</span>
                        <strong className="text-sm text-red-800">{evt.summary.no}</strong>
                      </div>
                    </div>

                    {/* Participants list preview */}
                    {evt.poll.participants.length > 0 && (
                      <div className="text-xs text-slate-600 space-y-1">
                        <span className="font-bold text-[11px] uppercase tracking-wider block text-slate-500">
                          {t('participantsHeader', currentLang)}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {evt.poll.participants.map((p) => {
                            const vote = p.votes[evt.slot.id];
                            if (!vote) return null;
                            return (
                              <span 
                                key={p.id}
                                className={`px-2 py-0.5 rounded-sm text-[11px] font-medium border flex items-center gap-1 ${
                                  vote === 'yes'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : vote === 'maybe'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-red-50 text-red-800 border-red-300'
                                }`}
                              >
                                {p.name}: {vote === 'yes' ? (currentLang === 'de' ? 'Ja' : 'Sì') : vote === 'maybe' ? (currentLang === 'de' ? 'Evtl.' : 'Se necess.') : (currentLang === 'de' ? 'Nein' : 'No')}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action button */}
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => {
                          setSelectedDayEvents(null);
                          onSelectPoll(evt.poll);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-dns-primary text-white hover:bg-dns-deep font-bold text-xs rounded-sm transition-all"
                      >
                        <span>{t('openPollVote', currentLang)}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-sm transition-colors"
              >
                {t('btnClose', currentLang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
