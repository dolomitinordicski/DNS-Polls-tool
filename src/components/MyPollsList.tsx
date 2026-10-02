import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  PlusCircle,
  Search,
  Trash2,
  Users,
  DatabaseBackup,
  Loader2,
} from 'lucide-react';
import { Poll } from '../types';
import { formatDate, getTopVotedSlot } from '../utils/dateUtils';
import {
  deletePollFromFirestore,
  getPollShareUrl,
  type FirestoreSyncStatus,
  type LegacyPollMigrationResult,
} from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { EditPollModal } from './EditPollModal';
import { ensurePrivateDataAdminSession } from '../data/privateRecipientSync';
import { confirmDNSAction, showDNSToast } from '@dolomitinordicski/dns-shared-data/ui/primitives';
import { dnsPollsCapabilities } from '../lib/foundation';

interface MyPollsListProps {
  polls: Poll[];
  onSelectPoll: (poll: Poll) => void;
  onCreateNew: () => void;
  onRefreshList: () => void;
  onOpenCalendarView: () => void;
  currentLang: Language;
  syncStatus: FirestoreSyncStatus;
  legacyPollCount?: number;
  isRecoveringLegacy?: boolean;
  legacyRecoveryResult?: LegacyPollMigrationResult | null;
  onRecoverLegacyPolls?: () => void;
}

type DashboardFilter = 'all' | 'open' | 'confirmed' | 'expired';
type PollLifecycle = Exclude<DashboardFilter, 'all'>;

function pollLifecycle(poll: Poll, today: string): PollLifecycle {
  if (poll.finalizedSlotId) {
    const finalized = poll.slots.find(slot => slot.id === poll.finalizedSlotId);
    if (finalized?.date && finalized.date < today) return 'expired';
    return 'confirmed';
  }

  if (poll.slots.length > 0 && poll.slots.every(slot => slot.date < today)) {
    return 'expired';
  }

  return 'open';
}

export const MyPollsList: React.FC<MyPollsListProps> = ({
  polls,
  onSelectPoll,
  onCreateNew,
  onRefreshList,
  onOpenCalendarView,
  currentLang,
  syncStatus,
  legacyPollCount = 0,
  isRecoveringLegacy = false,
  legacyRecoveryResult = null,
  onRecoverLegacyPolls,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const copy = currentLang === 'de'
    ? {
        kicker: 'Terminplanung',
        section: 'Umfragen',
        all: 'Alle',
        open: 'Offen',
        confirmed: 'Bestätigt',
        expired: 'Abgelaufen',
        source: 'Datenquelle',
        live: 'Firestore live',
        cached: 'Lokaler Cache',
        connecting: 'Verbindung…',
        restricted: 'Zugriff geschützt',
        offline: 'Offline',
        noLocation: 'Kein Ort angegeben',
        noResponses: 'Noch keine Antworten',
        nextOption: 'Nächster Termin',
        bestOption: 'Beste Option',
        confirmedDate: 'Bestätigter Termin',
        actions: 'Aktionen',
        poll: 'Umfrage',
        status: 'Status',
        responses: 'Antworten',
        date: 'Termin',
        clearSearch: 'Suche zurücksetzen',
        resultSingular: 'Umfrage',
        resultPlural: 'Umfragen',
        recoverLegacy: 'Lokale Umfragen wiederherstellen',
        recoveringLegacy: 'Wiederherstellung…',
        recoveryHint: 'Ältere browserlokale Umfragen nach Firestore übertragen.',
        recoveryDone: 'Wiederherstellung abgeschlossen',
        deleteAuthError: 'Für eine vollständige Löschung inklusive privater E-Mail-Daten ist die DNS-Admin-Anmeldung erforderlich.',
      }
    : {
        kicker: 'Pianificazione',
        section: 'Sondaggi',
        all: 'Tutti',
        open: 'Aperti',
        confirmed: 'Confermati',
        expired: 'Scaduti',
        source: 'Fonte dati',
        live: 'Firestore live',
        cached: 'Cache locale',
        connecting: 'Connessione…',
        restricted: 'Accesso protetto',
        offline: 'Offline',
        noLocation: 'Nessun luogo indicato',
        noResponses: 'Nessuna risposta',
        nextOption: 'Prossima data',
        bestOption: 'Opzione migliore',
        confirmedDate: 'Data confermata',
        actions: 'Azioni',
        poll: 'Sondaggio',
        status: 'Stato',
        responses: 'Risposte',
        date: 'Data',
        clearSearch: 'Azzera ricerca',
        resultSingular: 'sondaggio',
        resultPlural: 'sondaggi',
        recoverLegacy: 'Recupera poll locali',
        recoveringLegacy: 'Recupero…',
        recoveryHint: 'Importa in Firestore i poll storici ancora presenti nel browser.',
        recoveryDone: 'Recupero completato',
        deleteAuthError: 'Per eliminare completamente il poll, incluse le e-mail private, è necessario l’accesso amministratore DNS.',
      };

  const counts = useMemo(() => {
    const lifecycle = polls.reduce(
      (acc, poll) => {
        acc[pollLifecycle(poll, today)] += 1;
        return acc;
      },
      { open: 0, confirmed: 0, expired: 0 },
    );

    return {
      ...lifecycle,
      active: lifecycle.open + lifecycle.confirmed,
      responses: polls.reduce(
        (total, poll) => total + poll.participants.length,
        0,
      ),
    };
  }, [polls, today]);

  const filteredPolls = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return polls.filter(poll => {
      const lifecycle = pollLifecycle(poll, today);
      const matchesFilter = filter === 'all' || lifecycle === filter;
      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;

      return [
        poll.title,
        poll.organizerName,
        poll.location || '',
        poll.description || '',
      ].some(value => value.toLowerCase().includes(normalizedSearch));
    });
  }, [filter, polls, searchTerm, today]);

  const expiredPolls = useMemo(
    () => polls.filter(poll => pollLifecycle(poll, today) === 'expired'),
    [polls, today],
  );

  const handleCopyLink = async (poll: Poll, e: React.MouseEvent) => {
    e.stopPropagation();
    await dnsPollsCapabilities.run('clipboard.copy', { text: getPollShareUrl(poll) });
    setCopiedId(poll.id);
    window.setTimeout(() => setCopiedId(null), 2500);
  };

  const ensureDeleteAdmin = async (): Promise<boolean> => {
    try {
      await ensurePrivateDataAdminSession();
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      showDNSToast(
        detail
          ? `${copy.deleteAuthError} — ${detail}`
          : copy.deleteAuthError,
        'error',
        6000,
      );
      return false;
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(await confirmDNSAction({
      title: currentLang === 'de' ? 'Umfrage löschen' : 'Elimina sondaggio',
      message: t('confirmDelete', currentLang),
      confirmLabel: currentLang === 'de' ? 'Löschen' : 'Elimina',
      cancelLabel: currentLang === 'de' ? 'Abbrechen' : 'Annulla',
      destructive: true,
    }))) return;
    if (!(await ensureDeleteAdmin())) return;

    await deletePollFromFirestore(id);
    onRefreshList();
  };

  const handleDeleteOldPolls = async () => {
    if (expiredPolls.length === 0) return;
    if (!(await confirmDNSAction({
      title: currentLang === 'de' ? 'Alte Umfragen löschen' : 'Elimina vecchi sondaggi',
      message: `${t('confirmDeleteOld', currentLang)} (${expiredPolls.length})`,
      confirmLabel: currentLang === 'de' ? 'Löschen' : 'Elimina',
      cancelLabel: currentLang === 'de' ? 'Abbrechen' : 'Annulla',
      destructive: true,
    }))) return;

    if (!(await ensureDeleteAdmin())) return;

    for (const poll of expiredPolls) {
      await deletePollFromFirestore(poll.id);
    }

    onRefreshList();
  };

  const syncLabel = copy[syncStatus];
  const syncDotClass = [
    'h-2 w-2 rounded-full',
    syncStatus === 'live' ? 'bg-emerald-500' : '',
    syncStatus === 'cached' ? 'bg-amber-500' : '',
    syncStatus === 'restricted' ? 'bg-orange-500' : '',
    syncStatus === 'offline' ? 'bg-red-500' : '',
    syncStatus === 'connecting' ? 'bg-dns-light' : '',
  ].join(' ');

  const filterOptions: Array<{
    id: DashboardFilter;
    label: string;
    count: number;
  }> = [
    { id: 'all', label: copy.all, count: polls.length },
    { id: 'open', label: copy.open, count: counts.open },
    { id: 'confirmed', label: copy.confirmed, count: counts.confirmed },
    { id: 'expired', label: copy.expired, count: counts.expired },
  ];

  const renderStatus = (poll: Poll) => {
    const lifecycle = pollLifecycle(poll, today);

    return (
      <span
        className={[
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.06em]',
          lifecycle === 'open'
            ? 'border-dns-mid/20 bg-dns-bg text-dns-mid'
            : '',
          lifecycle === 'confirmed'
            ? 'border-emerald-700/20 bg-emerald-50 text-emerald-800'
            : '',
          lifecycle === 'expired'
            ? 'border-dns-mid/15 bg-dns-bg text-dns-muted'
            : '',
        ].join(' ')}
      >
        {lifecycle === 'confirmed' && <CheckCircle2 className="h-3 w-3" />}
        {copy[lifecycle]}
      </span>
    );
  };

  const getDisplaySlot = (poll: Poll) => {
    if (poll.finalizedSlotId) {
      const slot = poll.slots.find(item => item.id === poll.finalizedSlotId);
      return {
        slot,
        label: copy.confirmedDate,
      };
    }

    const topSlotId = getTopVotedSlot(poll.slots, poll.participants);
    const topSlot = poll.slots.find(item => item.id === topSlotId);

    if (topSlot && poll.participants.length > 0) {
      return {
        slot: topSlot,
        label: copy.bestOption,
      };
    }

    const nextSlot =
      poll.slots.find(item => item.date >= today) ||
      poll.slots[0];

    return {
      slot: nextSlot,
      label: copy.nextOption,
    };
  };

  const renderActions = (poll: Poll, compact = false) => (
    <div
      className={[
        'flex items-center',
        compact ? 'gap-1' : 'gap-1.5',
      ].join(' ')}
      onClick={event => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={event => void handleCopyLink(poll, event)}
        data-dns-press
        data-dns-hover
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg"
        title={copiedId === poll.id ? t('btnCopied', currentLang) : t('btnCopyLink', currentLang)}
        aria-label={copiedId === poll.id ? t('btnCopied', currentLang) : t('btnCopyLink', currentLang)}
      >
        {copiedId === poll.id
          ? <Check className="h-3.5 w-3.5" />
          : <Copy className="h-3.5 w-3.5" />}
      </button>

      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          setEditingPoll(poll);
        }}
        data-dns-press
        data-dns-hover
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg"
        title={t('btnEditPoll', currentLang)}
        aria-label={t('btnEditPoll', currentLang)}
      >
        <Edit3 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={event => void handleDelete(poll.id, event)}
        data-dns-press
        data-dns-hover
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
        title={t('btnDelete', currentLang)}
        aria-label={t('btnDelete', currentLang)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {!compact && (
        <button
          type="button"
          onClick={() => onSelectPoll(poll)}
          data-dns-press
          className="dns-button h-8 px-3" data-variant="primary"
        >
          {t('btnOpen', currentLang)}
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="dns-shell space-y-5 py-5 font-body">
      <section className="dns-card p-5 md:p-6" data-dns-reveal>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="max-w-2xl">
            <div className="dns-kicker">{copy.kicker}</div>
            <h1 className="mt-1 text-[27px] font-semibold tracking-[-.02em] text-dns-deep">
              {t('welcomeTitle', currentLang)}
            </h1>
            <p className="mt-2 max-w-xl font-alt text-[12px] leading-relaxed text-dns-muted">
              {t('welcomeSubtitle', currentLang)}
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={onOpenCalendarView}
              data-dns-press
              data-dns-hover
              className="dns-button min-h-9" data-variant="secondary"
            >
              <Calendar className="h-4 w-4" />
              {t('btnCalendarView', currentLang)}
            </button>
            <button
              type="button"
              onClick={onCreateNew}
              data-dns-press
              className="dns-button min-h-9" data-variant="primary"
            >
              <PlusCircle className="h-4 w-4" />
              {t('btnNewPoll', currentLang)}
            </button>
          </div>
        </div>
      </section>

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label={currentLang === 'de' ? 'Übersicht' : 'Riepilogo'}
      >
        <div className="dns-kpi" data-dns-reveal data-dns-reveal-index="0" data-dns-reveal-stagger="compact">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="dns-kicker">{t('kpiActivePolls', currentLang)}</div>
              <div className="mt-1 text-[26px] font-semibold leading-none text-dns-deep">
                {counts.active}
              </div>
            </div>
            <Calendar className="h-5 w-5 text-dns-mid" />
          </div>
        </div>

        <div className="dns-kpi" data-dns-reveal data-dns-reveal-index="1" data-dns-reveal-stagger="compact">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="dns-kicker">{t('kpiTotalVotes', currentLang)}</div>
              <div className="mt-1 text-[26px] font-semibold leading-none text-dns-deep">
                {counts.responses}
              </div>
            </div>
            <Users className="h-5 w-5 text-dns-mid" />
          </div>
        </div>

        <div className="dns-kpi" data-dns-reveal data-dns-reveal-index="2" data-dns-reveal-stagger="compact">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="dns-kicker">{t('kpiConfirmedDates', currentLang)}</div>
              <div className="mt-1 text-[26px] font-semibold leading-none text-dns-deep">
                {counts.confirmed}
              </div>
            </div>
            <CheckCircle2 className="h-5 w-5 text-dns-mid" />
          </div>
        </div>
      </section>

      <section className="dns-card overflow-hidden" data-dns-reveal>
        <div className="border-b border-dns-mid/10 p-5 md:p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <div className="dns-section-title">{copy.section}</div>
              <div className="mt-1 flex items-center gap-2 font-alt text-[10px] text-dns-muted">
                <span className={syncDotClass} aria-hidden="true" />
                <span>{copy.source}: {syncLabel}</span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
              <div className="relative w-full xl:w-[330px]">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dns-mid"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label={t('searchPlaceholder', currentLang)}
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder={t('searchPlaceholder', currentLang)}
                  className="dns-input h-9 w-full pl-9 pr-3"
                />
              </div>

              <div className="flex max-w-full gap-1 overflow-x-auto pb-1 xl:pb-0">
                {filterOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    data-dns-press
                    className={[
                      'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[10px] font-bold uppercase tracking-[.05em] transition-colors',
                      filter === option.id
                        ? 'border-dns-mid bg-dns-light text-dns-deep'
                        : 'border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg',
                    ].join(' ')}
                    aria-pressed={filter === option.id}
                  >
                    {option.label}
                    <span className="font-alt text-[9px] font-normal opacity-75">
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 font-alt text-[10px] text-dns-muted">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {filteredPolls.length}{' '}
                {filteredPolls.length === 1 ? copy.resultSingular : copy.resultPlural}
              </span>

              {legacyPollCount > 0 && onRecoverLegacyPolls && (
                <button
                  type="button"
                  onClick={onRecoverLegacyPolls}
                  disabled={isRecoveringLegacy}
                  data-dns-press
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-dns-mid/15 bg-dns-bg px-2.5 font-alt text-[9px] font-semibold text-dns-mid hover:bg-dns-light/20 disabled:cursor-not-allowed disabled:opacity-50"
                  title={copy.recoveryHint}
                >
                  {isRecoveringLegacy
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <DatabaseBackup className="h-3.5 w-3.5" />}
                  {isRecoveringLegacy
                    ? copy.recoveringLegacy
                    : `${copy.recoverLegacy} (${legacyPollCount})`}
                </button>
              )}

              {legacyRecoveryResult && (
                <span
                  className="inline-flex items-center gap-1.5 text-[9px] text-emerald-800"
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {copy.recoveryDone}: {legacyRecoveryResult.createdPolls}
                  {currentLang === 'de' ? ' neue' : ' nuovi'} · {legacyRecoveryResult.responsesUpserted}
                  {currentLang === 'de' ? ' Antworten' : ' risposte'}
                </span>
              )}
            </div>

            {expiredPolls.length > 0 && (
              <button
                type="button"
                onClick={() => void handleDeleteOldPolls()}
                data-dns-press
                data-dns-hover
                className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[10px] font-semibold text-red-700 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('btnDeleteOldPolls', currentLang)} ({expiredPolls.length})
              </button>
            )}
          </div>
        </div>

        {filteredPolls.length === 0 ? (
          <div className="px-5 py-14 text-center md:px-6">
            <Calendar className="mx-auto h-8 w-8 text-dns-light" />
            <h2 className="mt-4 text-[18px] font-semibold text-dns-deep">
              {t('emptyTitle', currentLang)}
            </h2>
            <p className="mx-auto mt-2 max-w-md font-alt text-[11px] leading-relaxed text-dns-muted">
              {t('emptySubtitle', currentLang)}
            </p>

            {searchTerm || filter !== 'all' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilter('all');
                }}
                data-dns-press
                className="dns-button mt-5" data-variant="secondary"
              >
                {copy.clearSearch}
              </button>
            ) : (
              <button
                type="button"
                onClick={onCreateNew}
                data-dns-press
                className="dns-button mt-5" data-variant="primary"
              >
                <PlusCircle className="h-4 w-4" />
                {t('btnCreateFirst', currentLang)}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[118px_minmax(260px,1.45fr)_minmax(150px,.75fr)_100px_minmax(190px,.8fr)_176px] items-center gap-4 border-b border-dns-mid/10 bg-dns-bg/70 px-5 py-2.5 font-alt text-[9px] font-bold uppercase tracking-[.06em] text-dns-muted md:px-6">
                <span>{copy.status}</span>
                <span>{copy.poll}</span>
                <span>{t('organizedBy', currentLang)}</span>
                <span>{copy.responses}</span>
                <span>{copy.date}</span>
                <span className="text-right">{copy.actions}</span>
              </div>

              <div className="divide-y divide-dns-mid/10">
                {filteredPolls.map((poll, index) => {
                  const display = getDisplaySlot(poll);

                  return (
                    <div
                      key={poll.id}
                      data-dns-hover
                      data-dns-reveal
                      data-dns-reveal-index={index}
                      data-dns-reveal-stagger="compact"
                      className="grid grid-cols-[118px_minmax(260px,1.45fr)_minmax(150px,.75fr)_100px_minmax(190px,.8fr)_176px] items-center gap-4 px-5 py-4 hover:bg-dns-bg/65 md:px-6"
                    >
                      <div>{renderStatus(poll)}</div>

                      <button
                        type="button"
                        onClick={() => onSelectPoll(poll)}
                        className="min-w-0 rounded-md border-0 bg-transparent p-0 text-left"
                      >
                        <div className="truncate text-[13px] font-semibold text-dns-deep hover:underline">
                          {poll.title}
                        </div>
                        <div className="mt-1 truncate font-alt text-[10px] text-dns-muted">
                          {poll.location || copy.noLocation}
                        </div>
                      </button>

                      <div className="truncate font-alt text-[11px] text-dns-deep">
                        {poll.organizerName}
                      </div>

                      <div>
                        <div className="text-[13px] font-semibold text-dns-deep">
                          {poll.participants.length}
                        </div>
                        <div className="mt-0.5 font-alt text-[9px] text-dns-muted">
                          {poll.participants.length === 0 ? copy.noResponses : t('votesCount', currentLang)}
                        </div>
                      </div>

                      <div className="min-w-0">
                        {display.slot ? (
                          <>
                            <div className="truncate text-[11px] font-semibold text-dns-deep">
                              {formatDate(display.slot.date, currentLang).dayMonth}
                              {display.slot.time ? ` · ${display.slot.time}` : ''}
                            </div>
                            <div className="mt-0.5 truncate font-alt text-[9px] text-dns-muted">
                              {display.label}
                            </div>
                          </>
                        ) : (
                          <span className="font-alt text-[10px] text-dns-muted">—</span>
                        )}
                      </div>

                      <div className="flex justify-end">
                        {renderActions(poll)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-dns-mid/10 lg:hidden">
              {filteredPolls.map((poll, index) => {
                const display = getDisplaySlot(poll);

                return (
                  <article
                    key={poll.id}
                    data-dns-reveal
                    data-dns-reveal-index={index}
                    data-dns-reveal-stagger="compact"
                    className="p-5"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPoll(poll)}
                      className="block w-full border-0 bg-transparent p-0 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        {renderStatus(poll)}
                        <span className="font-alt text-[10px] text-dns-muted">
                          {poll.participants.length} {t('votesCount', currentLang)}
                        </span>
                      </div>

                      <h2 className="mt-3 text-[15px] font-semibold leading-snug text-dns-deep">
                        {poll.title}
                      </h2>

                      <p className="mt-1 font-alt text-[10px] text-dns-muted">
                        {t('organizedBy', currentLang)} {poll.organizerName}
                        {poll.location ? ` · ${poll.location}` : ''}
                      </p>

                      {display.slot && (
                        <div className="mt-3 rounded-md border border-dns-mid/10 bg-dns-bg px-3 py-2">
                          <div className="dns-kicker">{display.label}</div>
                          <div className="mt-1 text-[11px] font-semibold text-dns-deep">
                            {formatDate(display.slot.date, currentLang).dayMonth}
                            {display.slot.time ? ` · ${display.slot.time}` : ''}
                          </div>
                        </div>
                      )}
                    </button>

                    <div className="mt-4 flex items-center justify-between border-t border-dns-mid/10 pt-3">
                      {renderActions(poll, true)}
                      <button
                        type="button"
                        onClick={() => onSelectPoll(poll)}
                        data-dns-press
                        className="dns-button h-8" data-variant="primary"
                      >
                        {t('btnOpen', currentLang)}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {editingPoll && (
        <EditPollModal
          poll={editingPoll}
          isOpen={Boolean(editingPoll)}
          onClose={() => setEditingPoll(null)}
          onSave={() => {
            onRefreshList();
            setEditingPoll(null);
          }}
          currentLang={currentLang}
        />
      )}
    </div>
  );
};
