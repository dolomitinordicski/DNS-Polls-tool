import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Trophy,
  X,
} from 'lucide-react';
import { Poll, TimeSlot } from '../types';
import {
  formatDate,
  getSlotVoteSummary,
  getTopVotedSlot,
} from '../utils/dateUtils';
import { Language, t } from '../utils/i18n';
import { useAccessibleDialog } from '../lib/useAccessibleDialog';

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
  summary: {
    yes: number;
    maybe: number;
    no: number;
    score: number;
  };
}

interface CalendarDay {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

function monthStartForPolls(polls: Poll[]): Date {
  for (const poll of polls) {
    const firstSlot = [...poll.slots]
      .filter(slot => slot.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (firstSlot) {
      const [year, month] = firstSlot.date.split('-').map(Number);
      if (year && month) return new Date(year, month - 1, 1);
    }
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const PollCalendarView: React.FC<PollCalendarViewProps> = ({
  polls,
  selectedPollId,
  onSelectPoll,
  onNavigateToVote,
  currentLang = 'de',
}) => {
  const [currentDate, setCurrentDate] = useState(() =>
    monthStartForPolls(polls),
  );
  const [activePollFilter, setActivePollFilter] = useState(
    selectedPollId || 'all',
  );
  const [selectedDayEvents, setSelectedDayEvents] = useState<{
    dateStr: string;
    events: CalendarEvent[];
  } | null>(null);
  const dayDialogRef = useRef<HTMLElement>(null);

  useAccessibleDialog({
    isOpen: Boolean(selectedDayEvents),
    onClose: () => setSelectedDayEvents(null),
    dialogRef: dayDialogRef,
  });

  useEffect(() => {
    if (selectedPollId) setActivePollFilter(selectedPollId);
  }, [selectedPollId]);

  const copy = currentLang === 'de'
    ? {
        kicker: 'Kalender',
        title: 'Team-Kalender',
        subtitle: 'Terminoptionen und bestätigte Termine im Monatsüberblick.',
        all: 'Alle Umfragen',
        filter: 'Umfrage',
        today: 'Heute',
        prev: 'Vorheriger Monat',
        next: 'Nächster Monat',
        legend: 'Status',
        ordinary: 'Terminoption',
        best: 'Beste Option',
        confirmed: 'Bestätigt',
        details: 'Termindetails',
        organizer: 'Organisator',
        yes: 'Ja',
        maybe: 'Falls nötig',
        no: 'Nein',
        openPoll: 'Umfrage öffnen',
        close: 'Schließen',
        options: 'Optionen',
        more: 'weitere',
        noEvents: 'Keine Termine',
      }
    : {
        kicker: 'Calendario',
        title: 'Calendario team',
        subtitle: 'Opzioni data e appuntamenti confermati nella vista mensile.',
        all: 'Tutti i sondaggi',
        filter: 'Sondaggio',
        today: 'Oggi',
        prev: 'Mese precedente',
        next: 'Mese successivo',
        legend: 'Stato',
        ordinary: 'Opzione data',
        best: 'Opzione migliore',
        confirmed: 'Confermata',
        details: 'Dettaglio data',
        organizer: 'Organizzatore',
        yes: 'Sì',
        maybe: 'Se necessario',
        no: 'No',
        openPoll: 'Apri sondaggio',
        close: 'Chiudi',
        options: 'opzioni',
        more: 'altre',
        noEvents: 'Nessun appuntamento',
      };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const filteredPolls = useMemo(
    () =>
      activePollFilter === 'all'
        ? polls
        : polls.filter(poll => poll.id === activePollFilter),
    [activePollFilter, polls],
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};

    filteredPolls.forEach(poll => {
      const topSlotId = getTopVotedSlot(poll.slots, poll.participants);

      poll.slots.forEach(slot => {
        if (!slot.date) return;

        const event: CalendarEvent = {
          poll,
          slot,
          isTopSlot: slot.id === topSlotId,
          isFinalized: poll.finalizedSlotId === slot.id,
          summary: getSlotVoteSummary(slot.id, poll.participants),
        };

        (map[slot.date] ??= []).push(event);
      });
    });

    Object.values(map).forEach(events =>
      events.sort((a, b) =>
        (a.slot.time || '').localeCompare(b.slot.time || ''),
      ),
    );

    return map;
  }, [filteredPolls]);

  const calendarGrid = useMemo<CalendarDay[]>(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    let mondayIndex = firstDay.getDay() - 1;
    if (mondayIndex < 0) mondayIndex = 6;

    const totalCells = Math.ceil((mondayIndex + daysInMonth) / 7) * 7;
    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    return Array.from({ length: totalCells }, (_, index) => {
      const dayOffset = index - mondayIndex + 1;
      const date = new Date(year, month, dayOffset);
      const dateStr = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');

      return {
        dateStr,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: dateStr === todayStr,
      };
    });
  }, [month, year]);

  const monthNames = currentLang === 'de'
    ? [
        'Januar',
        'Februar',
        'März',
        'April',
        'Mai',
        'Juni',
        'Juli',
        'August',
        'September',
        'Oktober',
        'November',
        'Dezember',
      ]
    : [
        'Gennaio',
        'Febbraio',
        'Marzo',
        'Aprile',
        'Maggio',
        'Giugno',
        'Luglio',
        'Agosto',
        'Settembre',
        'Ottobre',
        'Novembre',
        'Dicembre',
      ];

  const weekdayNames =
    currentLang === 'de'
      ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
      : ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <div className="space-y-5 font-body">
      <section className="dns-card p-5 md:p-6" data-dns-reveal>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="dns-kicker">{copy.kicker}</div>
            <h2 className="mt-1 text-[20px] font-semibold text-dns-deep">
              {copy.title}
            </h2>
            <p className="mt-1 font-alt text-[10px] text-dns-muted">
              {copy.subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-[240px]">
              <span className="flex items-center gap-1.5 dns-kicker">
                <Filter className="h-3.5 w-3.5" />
                {copy.filter}
              </span>
              <select
                id="cal-poll-filter-select"
                value={activePollFilter}
                onChange={event => setActivePollFilter(event.target.value)}
                className="dns-input mt-1.5 h-9 w-full"
              >
                <option value="all">
                  {copy.all} ({polls.length})
                </option>
                {polls.map(poll => (
                  <option key={poll.id} value={poll.id}>
                    {poll.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-1">
              <button
                type="button"
                id="cal-prev-month-btn"
                onClick={() =>
                  setCurrentDate(new Date(year, month - 1, 1))
                }
                data-dns-press
                data-dns-hover
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg"
                aria-label={copy.prev}
                title={copy.prev}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                id="cal-today-btn"
                onClick={goToToday}
                data-dns-press
                className="dns-button h-9" data-variant="secondary"
              >
                {copy.today}
              </button>

              <button
                type="button"
                id="cal-next-month-btn"
                onClick={() =>
                  setCurrentDate(new Date(year, month + 1, 1))
                }
                data-dns-press
                data-dns-hover
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg"
                aria-label={copy.next}
                title={copy.next}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 border-t border-dns-mid/10 pt-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-dns-mid" />
            <span className="text-[16px] font-semibold text-dns-deep">
              {monthNames[month]} {year}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-alt text-[9px] text-dns-muted">
            <span className="dns-kicker">{copy.legend}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-dns-mid/35" />
              {copy.ordinary}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-dns-mid" />
              {copy.best}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
              {copy.confirmed}
            </span>
          </div>
        </div>
      </section>

      <section className="dns-card overflow-hidden" data-dns-reveal>
        <div className="overflow-x-auto">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-7 border-b border-dns-mid/10 bg-dns-bg">
              {weekdayNames.map((day, index) => (
                <div
                  key={day}
                  className={[
                    'px-2 py-2.5 text-center font-alt text-[9px] font-bold uppercase tracking-[.06em]',
                    index >= 5 ? 'text-dns-muted' : 'text-dns-mid',
                  ].join(' ')}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarGrid.map(day => {
                const events = eventsByDate[day.dateStr] || [];
                const hasFinal = events.some(event => event.isFinalized);
                const hasTop = events.some(event => event.isTopSlot);

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    disabled={events.length === 0}
                    onClick={() =>
                      setSelectedDayEvents({
                        dateStr: day.dateStr,
                        events,
                      })
                    }
                    className={[
                      'min-h-[128px] border-b border-r border-dns-mid/10 p-2.5 text-left align-top transition-colors',
                      day.isCurrentMonth
                        ? 'bg-white'
                        : 'bg-dns-bg/55 text-dns-muted',
                      events.length > 0
                        ? 'cursor-pointer hover:bg-dns-bg'
                        : 'cursor-default',
                      day.isToday
                        ? 'ring-1 ring-inset ring-dns-mid'
                        : '',
                      hasFinal
                        ? 'bg-emerald-50/35'
                        : hasTop
                          ? 'bg-dns-light/10'
                          : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={[
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 font-alt text-[10px] font-semibold',
                          day.isToday
                            ? 'bg-dns-deep text-white'
                            : day.isCurrentMonth
                              ? 'text-dns-deep'
                              : 'text-dns-muted',
                        ].join(' ')}
                      >
                        {day.dayNumber}
                      </span>

                      {hasFinal ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                      ) : hasTop ? (
                        <Trophy className="h-3.5 w-3.5 text-dns-mid" />
                      ) : null}
                    </div>

                    <div className="mt-2 space-y-1.5">
                      {events.slice(0, 3).map(event => (
                        <div
                          key={`${event.poll.id}-${event.slot.id}`}
                          className={[
                            'rounded-md border px-2 py-1.5',
                            event.isFinalized
                              ? 'border-emerald-300 bg-emerald-50'
                              : event.isTopSlot
                                ? 'border-dns-mid/20 bg-dns-light/15'
                                : 'border-dns-mid/10 bg-dns-bg',
                          ].join(' ')}
                        >
                          <div className="truncate text-[9px] font-semibold text-dns-deep">
                            {event.poll.title}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2 font-alt text-[8px] text-dns-muted">
                            <span className="inline-flex min-w-0 items-center gap-1 truncate">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              {event.slot.time || t('allDay', currentLang)}
                            </span>
                            <span className="shrink-0 font-semibold text-emerald-800">
                              {event.summary.yes} {copy.yes}
                            </span>
                          </div>
                        </div>
                      ))}

                      {events.length > 3 && (
                        <div className="text-center font-alt text-[8px] text-dns-muted">
                          +{events.length - 3} {copy.more}
                        </div>
                      )}
                    </div>

                    {events.length > 0 && (
                      <div className="mt-2 text-right font-alt text-[8px] text-dns-muted">
                        {events.length} {copy.options}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {selectedDayEvents && (
        <div
          className="dns-modal-overlay"
          role="presentation"
          onMouseDown={event => {
            if (event.currentTarget === event.target) setSelectedDayEvents(null);
          }}
        >
          <section
            ref={dayDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-day-dialog-title"
            tabIndex={-1}
            className="dns-card max-h-[90dvh] w-full max-w-xl overflow-hidden outline-none"
          >
            <div className="flex items-start justify-between gap-4 border-b border-dns-mid/10 p-5">
              <div>
                <div className="dns-kicker">{copy.details}</div>
                <h3
                  id="calendar-day-dialog-title"
                  className="mt-1 text-[16px] font-semibold text-dns-deep"
                >
                  {formatDate(
                    selectedDayEvents.dateStr,
                    currentLang,
                  ).fullFormatted}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDayEvents(null)}
                data-dns-press
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dns-mid/10 bg-white text-dns-mid hover:bg-dns-bg"
                aria-label={copy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[64vh] space-y-3 overflow-y-auto p-5">
              {selectedDayEvents.events.length === 0 ? (
                <p className="font-alt text-[10px] text-dns-muted">
                  {copy.noEvents}
                </p>
              ) : (
                selectedDayEvents.events.map(event => (
                  <article
                    key={`${event.poll.id}-${event.slot.id}`}
                    className="rounded-lg border border-dns-mid/10 bg-white p-4"
                  >
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-[12px] font-semibold text-dns-deep">
                            {event.poll.title}
                          </h4>

                          {event.isFinalized && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-alt text-[8px] font-bold uppercase tracking-[.05em] text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              {copy.confirmed}
                            </span>
                          )}

                          {!event.isFinalized && event.isTopSlot && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-dns-mid/15 bg-dns-bg px-2 py-0.5 font-alt text-[8px] font-bold uppercase tracking-[.05em] text-dns-mid">
                              <Trophy className="h-3 w-3" />
                              {copy.best}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 font-alt text-[9px] text-dns-muted">
                          {copy.organizer}: {event.poll.organizerName}
                        </div>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-dns-mid/10 bg-dns-bg px-2 py-1 font-alt text-[9px] text-dns-deep">
                        <Clock className="h-3 w-3 text-dns-mid" />
                        {event.slot.time || t('allDay', currentLang)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-md border border-dns-mid/10 bg-dns-bg p-2.5 text-center">
                      <div>
                        <div className="dns-kicker">{copy.yes}</div>
                        <div className="mt-0.5 text-[14px] font-semibold text-emerald-800">
                          {event.summary.yes}
                        </div>
                      </div>
                      <div>
                        <div className="dns-kicker">{copy.maybe}</div>
                        <div className="mt-0.5 text-[14px] font-semibold text-amber-800">
                          {event.summary.maybe}
                        </div>
                      </div>
                      <div>
                        <div className="dns-kicker">{copy.no}</div>
                        <div className="mt-0.5 text-[14px] font-semibold text-red-800">
                          {event.summary.no}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDayEvents(null);

                          if (onNavigateToVote) {
                            onNavigateToVote(event.poll, event.slot.id);
                          } else {
                            onSelectPoll(event.poll);
                          }
                        }}
                        data-dns-press
                        className="dns-button min-h-8" data-variant="primary"
                      >
                        {copy.openPoll}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
