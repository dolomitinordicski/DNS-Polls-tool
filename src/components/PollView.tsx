import React, { useState } from 'react';
import { Poll, VoteStatus } from '../types';
import { formatDate, getSlotVoteSummary, getTopVotedSlot } from '../utils/dateUtils';
import { generateICalFile } from '../utils/storage';
import { getPollShareUrl, submitParticipantVote, finalizePollSlotFirestore, deletePollFromFirestore } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { PollTable } from './PollTable';
import { PollCalendarView } from './PollCalendarView';
import { ShareModal } from './ShareModal';
import { EditPollModal } from './EditPollModal';
import { 
  ArrowLeft, 
  Share2, 
  Calendar as CalendarIcon, 
  MapPin, 
  User, 
  CheckCircle2, 
  Download, 
  Copy, 
  Check, 
  MessageSquare, 
  Trophy, 
  List,
  Trash2,
  Edit3
} from 'lucide-react';

interface PollViewProps {
  poll: Poll;
  onPollUpdated: (poll: Poll) => void;
  onBackToList: () => void;
  currentLang: Language;
  isInviteeMode?: boolean;
}

export const PollView: React.FC<PollViewProps> = ({ poll, onPollUpdated, onBackToList, currentLang, isInviteeMode = false }) => {
  const [activeTab, setActiveTab] = useState<'table' | 'calendar'>('table');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [copiedQuick, setCopiedQuick] = useState(false);
  const [isInvitee, setIsInvitee] = useState(isInviteeMode);

  const topSlotId = getTopVotedSlot(poll.slots, poll.participants);
  const topSlot = poll.slots.find(s => s.id === (poll.finalizedSlotId || topSlotId));

  const handleVoteSubmit = async (participantName: string, votes: Record<string, VoteStatus>) => {
    const updated = await submitParticipantVote(poll, participantName, votes);
    onPollUpdated(updated);
  };

  const handleFinalizeSlot = async (slotId: string) => {
    const updated = await finalizePollSlotFirestore(poll, slotId);
    onPollUpdated(updated);
  };

  const handleQuickCopyLink = () => {
    const shareUrl = getPollShareUrl(poll);
    navigator.clipboard.writeText(shareUrl);
    setCopiedQuick(true);
    setTimeout(() => setCopiedQuick(false), 2500);
  };

  const handleDeleteThisPoll = async () => {
    if (window.confirm(t('confirmDelete', currentLang))) {
      await deletePollFromFirestore(poll.id);
      onBackToList();
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in font-body">
      {/* Top Header Navigation & Mode Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {!isInvitee ? (
          <button
            onClick={onBackToList}
            id="back-to-polls-btn"
            className="flex items-center gap-2 text-slate-700 hover:text-dns-primary font-medium text-xs transition-colors py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('btnAllPolls', currentLang)}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-[#083845] bg-sky-50 px-3 py-1.5 rounded-sm border border-sky-200">
            <span>📋 {t('inviteeNotice', currentLang)}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!isInvitee ? (
            <>
              <button
                onClick={() => setIsInvitee(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-sm text-xs font-semibold transition-all"
                title={t('switchInviteeMode', currentLang)}
              >
                <span>👁️ {t('switchInviteeMode', currentLang)}</span>
              </button>

              <button
                onClick={() => setIsEditOpen(true)}
                id="open-edit-modal-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-sm text-xs font-semibold transition-all"
                title={t('btnEditPoll', currentLang)}
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                <span>{t('btnEditPoll', currentLang)}</span>
              </button>

              <button
                onClick={handleDeleteThisPoll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-800 rounded-sm text-xs font-semibold transition-all"
                title={t('btnDelete', currentLang)}
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>{t('btnDelete', currentLang)}</span>
              </button>

              <button
                onClick={handleQuickCopyLink}
                id="quick-copy-link-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-dns-primary text-slate-800 rounded-sm text-xs font-semibold transition-all shadow-xs"
              >
                {copiedQuick ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedQuick ? t('btnCopied', currentLang) : t('btnCopyLink', currentLang)}</span>
              </button>

              <button
                onClick={() => setIsShareOpen(true)}
                id="open-share-modal-btn"
                className="flex items-center gap-2 px-4 py-1.5 bg-dns-primary text-white hover:bg-dns-deep font-bold text-xs rounded-sm shadow-xs transition-all"
              >
                <Share2 className="w-4 h-4 text-white" />
                <span>{t('btnSharePoll', currentLang)}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsInvitee(false)}
              className="text-xs text-slate-600 hover:text-dns-primary font-semibold underline transition-colors"
            >
              {t('switchOrganizerMode', currentLang)}
            </button>
          )}
        </div>
      </div>

      {/* Poll Details Card */}
      <div className="bg-white border border-slate-300 rounded-sm p-6 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {poll.finalizedSlotId ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {t('officialDateConfirmed', currentLang)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded-sm text-xs font-bold">
                  <CalendarIcon className="w-3.5 h-3.5 text-dns-primary" />
                  {t('pollOpen', currentLang)}
                </span>
              )}
            </div>

            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#083845] tracking-tight">
              {poll.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-600 pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <User className="w-4 h-4 text-slate-500" />
                {t('organizer', currentLang)} <strong className="text-[#083845]">{poll.organizerName}</strong>
              </span>

              {poll.location && (
                <span className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  {t('location', currentLang)} <strong className="text-[#083845]">{poll.location}</strong>
                </span>
              )}
            </div>
          </div>

          {/* iCal Download if finalized or top slot */}
          {topSlot && (
            <div className="shrink-0 pt-2 md:pt-0">
              <button
                onClick={() => generateICalFile(poll, topSlot.id)}
                id="export-ical-btn"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 border border-slate-300 hover:border-dns-primary text-slate-800 rounded-sm text-xs font-bold transition-colors shadow-xs"
              >
                <Download className="w-4 h-4 text-dns-primary" />
                <span>{t('btnDownloadICal', currentLang)}</span>
              </button>
            </div>
          )}
        </div>

        {/* Description Text */}
        {poll.description && (
          <div className="bg-slate-50 border border-slate-200 rounded-sm p-3.5 text-xs text-slate-700 leading-relaxed space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {t('notesForParticipants', currentLang)}
            </span>
            <p className="text-sm text-slate-800">{poll.description}</p>
          </div>
        )}

        {/* Top Recommendation Box */}
        {topSlot && poll.participants.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-900 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-sm shrink-0">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                  {poll.finalizedSlotId ? t('finalDateSelected', currentLang) : t('topVotedDate', currentLang)}
                </span>
                <span className="font-heading font-extrabold text-base text-slate-900">
                  {formatDate(topSlot.date, currentLang).fullFormatted} ({topSlot.time || t('allDay', currentLang)})
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-700 bg-white px-3 py-1 rounded-sm border border-amber-300 font-mono font-bold">
              {getSlotVoteSummary(topSlot.id, poll.participants).yes} {currentLang === 'de' ? 'Verfügbar (Ja)' : 'Disponibilità SÌ'}
            </div>
          </div>
        )}
      </div>

      {/* Main View Mode Selector Tabs */}
      <div className="flex items-center justify-between border-b border-slate-300 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('table')}
            id="tab-view-table-btn"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-bold transition-all ${
              activeTab === 'table'
                ? 'bg-dns-primary text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
            }`}
          >
            <List className="w-4 h-4" />
            <span>{t('tabTable', currentLang)}</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            id="tab-view-calendar-btn"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-bold transition-all ${
              activeTab === 'calendar'
                ? 'bg-dns-primary text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>{t('tabCalendar', currentLang)}</span>
          </button>
        </div>

        <span className="text-xs text-slate-600 font-medium hidden sm:inline">
          {poll.participants.length} {t('participantsSynced', currentLang)}
        </span>
      </div>

      {/* Tab 1: Table View */}
      {activeTab === 'table' && (
        <PollTable
          poll={poll}
          onVoteSubmit={handleVoteSubmit}
          onFinalizeSlot={handleFinalizeSlot}
          isOrganizerView={!isInvitee}
          currentLang={currentLang}
        />
      )}

      {/* Tab 2: Calendar View */}
      {activeTab === 'calendar' && (
        <PollCalendarView
          polls={[poll]}
          selectedPollId={poll.id}
          onSelectPoll={() => {}}
          currentLang={currentLang}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        poll={poll}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        currentLang={currentLang}
      />

      {/* Edit Poll Modal */}
      <EditPollModal
        poll={poll}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={(updated) => onPollUpdated(updated)}
        currentLang={currentLang}
      />
    </div>
  );
};
