import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  List,
  MapPin,
  MessageSquare,
  Share2,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { ParticipantIdentity, Poll, VoteStatus } from '../types';
import {
  formatDate,
  getSlotVoteSummary,
  getTopVotedSlot,
} from '../utils/dateUtils';
import {
  deletePollFromFirestore,
  finalizePollSlotFirestore,
  getPollShareUrl,
  submitParticipantVote,
} from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { PollTable } from './PollTable';
import { PollCalendarView } from './PollCalendarView';
import { ShareModal } from './ShareModal';
import { EditPollModal } from './EditPollModal';
import { FinalizationPanel } from './FinalizationPanel';
import { ensurePrivateDataAdminSession } from '../data/privateRecipientSync';

interface PollViewProps {
  poll: Poll;
  onPollUpdated: (poll: Poll) => void;
  onBackToList: () => void;
  currentLang: Language;
  isInviteeMode?: boolean;
}

export const PollView: React.FC<PollViewProps> = ({
  poll,
  onPollUpdated,
  onBackToList,
  currentLang,
  isInviteeMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'table' | 'calendar'>('table');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [copiedQuick, setCopiedQuick] = useState(false);
  const [previewInvitee, setPreviewInvitee] = useState(false);

  const isInvitee = isInviteeMode || previewInvitee;
  const topSlotId = getTopVotedSlot(poll.slots, poll.participants);
  const selectedSlotId = poll.finalizedSlotId || topSlotId;
  const selectedSlot = poll.slots.find(slot => slot.id === selectedSlotId);
  const selectedSummary = selectedSlot
    ? getSlotVoteSummary(selectedSlot.id, poll.participants)
    : null;

  const copy = currentLang === 'de'
    ? {
        organizerView: 'Organisatoransicht',
        inviteePreview: 'Einladungsansicht',
        backToOrganizer: 'Zur Organisatoransicht',
        open: 'Offen',
        confirmed: 'Termin bestätigt',
        responses: 'Antworten',
        options: 'Terminoptionen',
        bestAvailability: 'Beste Verfügbarkeit',
        noAvailability: 'Noch keine',
        pollDetails: 'Umfragedetails',
        actions: 'Verwaltung',
        responseSection: 'Verfügbarkeit',
        calendarSection: 'Kalender',
        invitationKicker: 'Terminanfrage',
        invitationTitle: 'Bitte geben Sie Ihre Verfügbarkeit an',
        invitationDesc: 'Wählen Sie für jeden vorgeschlagenen Termin eine Antwort und senden Sie Ihre Angaben anschließend ab.',
        share: 'Teilen',
        copyLink: 'Link kopieren',
        copied: 'Kopiert',
        edit: 'Bearbeiten',
        delete: 'Löschen',
        topOption: 'Beste Option',
        confirmedOption: 'Bestätigter Termin',
        yesResponses: 'Ja-Antworten',
        noDescription: 'Keine zusätzlichen Hinweise.',
        deleteAuthError: 'Für eine vollständige Löschung inklusive privater E-Mail-Daten ist die DNS-Admin-Anmeldung erforderlich.',
      }
    : {
        organizerView: 'Vista organizzatore',
        inviteePreview: 'Anteprima invitato',
        backToOrganizer: 'Torna alla vista organizzatore',
        open: 'Aperto',
        confirmed: 'Data confermata',
        responses: 'Risposte',
        options: 'Opzioni data',
        bestAvailability: 'Migliore disponibilità',
        noAvailability: 'Ancora nessuna',
        pollDetails: 'Dettagli sondaggio',
        actions: 'Gestione',
        responseSection: 'Disponibilità',
        calendarSection: 'Calendario',
        invitationKicker: 'Richiesta appuntamento',
        invitationTitle: 'Indica la tua disponibilità',
        invitationDesc: 'Scegli una risposta per ogni data proposta e invia poi i tuoi dati.',
        share: 'Condividi',
        copyLink: 'Copia link',
        copied: 'Copiato',
        edit: 'Modifica',
        delete: 'Elimina',
        topOption: 'Opzione migliore',
        confirmedOption: 'Data confermata',
        yesResponses: 'Risposte sì',
        noDescription: 'Nessuna nota aggiuntiva.',
        deleteAuthError: 'Per eliminare completamente il poll, incluse le e-mail private, è necessario l’accesso amministratore DNS.',
      };

  useEffect(() => {
    if (isInvitee) setActiveTab('table');
  }, [isInvitee]);

  const handleVoteSubmit = async (
    participant: ParticipantIdentity,
    votes: Record<string, VoteStatus>,
    editingParticipantId?: string,
  ) => {
    const updated = await submitParticipantVote(
      poll,
      participant,
      votes,
      editingParticipantId,
    );
    onPollUpdated(updated);
  };

  const handleFinalizeSlot = async (slotId: string) => {
    const updated = await finalizePollSlotFirestore(poll, slotId);
    onPollUpdated(updated);
  };

  const handleQuickCopyLink = async () => {
    await navigator.clipboard.writeText(getPollShareUrl(poll));
    setCopiedQuick(true);
    window.setTimeout(() => setCopiedQuick(false), 2200);
  };

  const handleDeleteThisPoll = async () => {
    if (!window.confirm(t('confirmDelete', currentLang))) return;

    try {
      await ensurePrivateDataAdminSession();
      await deletePollFromFirestore(poll.id);
      onBackToList();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      window.alert(
        detail
          ? `${copy.deleteAuthError}\n\n${detail}`
          : copy.deleteAuthError,
      );
    }
  };

  const organizerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setPreviewInvitee(true)}
        data-dns-press
        data-dns-hover
        className="dns-btn-secondary min-h-8"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {copy.inviteePreview}
      </button>

      <button
        type="button"
        onClick={() => setIsEditOpen(true)}
        id="open-edit-modal-btn"
        data-dns-press
        data-dns-hover
        className="dns-btn-secondary min-h-8"
      >
        <Edit3 className="h-3.5 w-3.5" />
        {copy.edit}
      </button>

      <button
        type="button"
        onClick={() => void handleQuickCopyLink()}
        id="quick-copy-link-btn"
        data-dns-press
        data-dns-hover
        className="dns-btn-secondary min-h-8"
      >
        {copiedQuick
          ? <Check className="h-3.5 w-3.5" />
          : <Copy className="h-3.5 w-3.5" />}
        {copiedQuick ? copy.copied : copy.copyLink}
      </button>

      <button
        type="button"
        onClick={() => setIsShareOpen(true)}
        id="open-share-modal-btn"
        data-dns-press
        className="dns-btn-primary min-h-8"
      >
        <Share2 className="h-3.5 w-3.5" />
        {copy.share}
      </button>

      <button
        type="button"
        onClick={() => void handleDeleteThisPoll()}
        data-dns-press
        data-dns-hover
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 font-alt text-[10px] font-semibold text-red-800 hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {copy.delete}
      </button>
    </div>
  );

  const statusBadge = (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-alt text-[9px] font-bold uppercase tracking-[.06em]',
        poll.finalizedSlotId
          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
          : 'border-dns-mid/15 bg-dns-bg text-dns-mid',
      ].join(' ')}
    >
      {poll.finalizedSlotId
        ? <CheckCircle2 className="h-3 w-3" />
        : <CalendarIcon className="h-3 w-3" />}
      {poll.finalizedSlotId ? copy.confirmed : copy.open}
    </span>
  );

  const detailCard = (
    <section className="dns-card p-5 md:p-6" data-dns-reveal>
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            <span className="font-alt text-[9px] uppercase tracking-[.06em] text-dns-muted">
              {isInvitee ? copy.invitationKicker : copy.organizerView}
            </span>
          </div>

          <h1 className="mt-3 text-[27px] font-semibold leading-tight tracking-[-.02em] text-dns-deep md:text-[30px]">
            {poll.title}
          </h1>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-alt text-[10px] text-dns-muted">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-dns-mid" />
              <strong className="font-semibold text-dns-deep">
                {poll.organizerName}
              </strong>
            </span>

            {poll.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-dns-mid" />
                <strong className="font-semibold text-dns-deep">
                  {poll.location}
                </strong>
              </span>
            )}
          </div>
        </div>

        {!isInvitee && organizerActions}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-dns-mid/10 bg-dns-bg p-3">
          <div className="dns-kicker">{copy.responses}</div>
          <div className="mt-1 text-[20px] font-semibold leading-none text-dns-deep">
            {poll.participants.length}
          </div>
        </div>

        <div className="rounded-lg border border-dns-mid/10 bg-dns-bg p-3">
          <div className="dns-kicker">{copy.options}</div>
          <div className="mt-1 text-[20px] font-semibold leading-none text-dns-deep">
            {poll.slots.length}
          </div>
        </div>

        <div className="rounded-lg border border-dns-mid/10 bg-dns-bg p-3">
          <div className="dns-kicker">{copy.bestAvailability}</div>
          <div className="mt-1 text-[20px] font-semibold leading-none text-dns-deep">
            {selectedSummary ? selectedSummary.yes : '—'}
          </div>
          <div className="mt-1 font-alt text-[9px] text-dns-muted">
            {selectedSummary ? copy.yesResponses : copy.noAvailability}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.55fr)]">
        <div className="rounded-lg border border-dns-mid/10 bg-white p-4">
          <div className="flex items-center gap-1.5 dns-kicker">
            <MessageSquare className="h-3.5 w-3.5" />
            {copy.pollDetails}
          </div>
          <p className="mt-2 whitespace-pre-line font-alt text-[11px] leading-relaxed text-dns-deep">
            {poll.description || copy.noDescription}
          </p>
        </div>

        {selectedSlot && (
          <div
            className={[
              'rounded-lg border p-4',
              poll.finalizedSlotId
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-dns-mid/15 bg-dns-light/15',
            ].join(' ')}
          >
            <div className="dns-kicker">
              {poll.finalizedSlotId ? copy.confirmedOption : copy.topOption}
            </div>
            <div className="mt-2 text-[13px] font-semibold text-dns-deep">
              {formatDate(selectedSlot.date, currentLang).fullFormatted}
            </div>
            <div className="mt-1 font-alt text-[10px] text-dns-muted">
              {selectedSlot.time || t('allDay', currentLang)}
            </div>
            {selectedSummary && (
              <div className="mt-3 border-t border-dns-mid/10 pt-3 font-alt text-[9px] text-dns-muted">
                <strong className="text-emerald-800">{selectedSummary.yes}</strong> {copy.yesResponses}
                {poll.allowMaybe && (
                  <span className="ml-2">
                    · <strong className="text-amber-800">{selectedSummary.maybe}</strong> {t('voteMaybe', currentLang)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="dns-shell space-y-5 py-5 font-body">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        {!isInvitee ? (
          <button
            type="button"
            onClick={onBackToList}
            id="back-to-polls-btn"
            data-dns-press
            className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 font-alt text-[10px] font-semibold text-dns-mid hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('btnAllPolls', currentLang)}
          </button>
        ) : !isInviteeMode ? (
          <button
            type="button"
            onClick={() => setPreviewInvitee(false)}
            data-dns-press
            className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 font-alt text-[10px] font-semibold text-dns-mid hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.backToOrganizer}
          </button>
        ) : (
          <span className="dns-kicker">{t('inviteeHeaderTag', currentLang)}</span>
        )}

        {!isInvitee && (
          <span className="font-alt text-[9px] uppercase tracking-[.06em] text-dns-muted">
            {copy.organizerView}
          </span>
        )}
      </div>

      {isInvitee && (
        <section
          className="rounded-lg border border-dns-mid/15 bg-dns-light/20 p-4 md:p-5"
          data-dns-reveal
        >
          <div className="dns-kicker">{copy.invitationKicker}</div>
          <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
            {copy.invitationTitle}
          </h2>
          <p className="mt-1 max-w-2xl font-alt text-[10px] leading-relaxed text-dns-muted">
            {copy.invitationDesc}
          </p>
        </section>
      )}

      {detailCard}

      {!isInvitee && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-b border-dns-mid/10 pb-3"
          data-dns-reveal
        >
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              id="tab-view-table-btn"
              data-dns-press
              className={[
                'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 font-alt text-[10px] font-semibold',
                activeTab === 'table'
                  ? 'border-dns-mid bg-dns-light text-dns-deep'
                  : 'border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg',
              ].join(' ')}
            >
              <List className="h-4 w-4" />
              {copy.responseSection}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              id="tab-view-calendar-btn"
              data-dns-press
              className={[
                'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 font-alt text-[10px] font-semibold',
                activeTab === 'calendar'
                  ? 'border-dns-mid bg-dns-light text-dns-deep'
                  : 'border-dns-mid/15 bg-white text-dns-mid hover:bg-dns-bg',
              ].join(' ')}
            >
              <CalendarIcon className="h-4 w-4" />
              {copy.calendarSection}
            </button>
          </div>

          <span className="inline-flex items-center gap-1.5 font-alt text-[9px] text-dns-muted">
            <Users className="h-3.5 w-3.5" />
            {poll.participants.length} {t('participantsHeader', currentLang)}
          </span>
        </div>
      )}

      {(isInvitee || activeTab === 'table') && (
        <PollTable
          poll={poll}
          onVoteSubmit={handleVoteSubmit}
          isOrganizerView={!isInvitee}
          currentLang={currentLang}
        />
      )}

      {!isInvitee && activeTab === 'calendar' && (
        <PollCalendarView
          polls={[poll]}
          selectedPollId={poll.id}
          onSelectPoll={() => {}}
          currentLang={currentLang}
        />
      )}

      {!isInvitee && (
        <FinalizationPanel
          poll={poll}
          currentLang={currentLang}
          onFinalizeSlot={handleFinalizeSlot}
          onPollUpdated={onPollUpdated}
        />
      )}

      <ShareModal
        poll={poll}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        currentLang={currentLang}
      />

      <EditPollModal
        poll={poll}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={updated => onPollUpdated(updated)}
        currentLang={currentLang}
      />
    </div>
  );
};
