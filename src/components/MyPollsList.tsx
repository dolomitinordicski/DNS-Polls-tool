import React, { useState } from 'react';
import { Poll } from '../types';
import { getTopVotedSlot, formatDate } from '../utils/dateUtils';
import { deletePollFromFirestore, getPollShareUrl } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { EditPollModal } from './EditPollModal';
import dnsLogoFarbe from '../assets/dns-logo-farbe.png';
import { 
  Calendar, 
  Users, 
  PlusCircle, 
  Search, 
  Trash2, 
  ExternalLink, 
  CheckCircle2, 
  Copy, 
  Check,
  Edit3
} from 'lucide-react';

interface MyPollsListProps {
  polls: Poll[];
  onSelectPoll: (poll: Poll) => void;
  onCreateNew: () => void;
  onRefreshList: () => void;
  onOpenCalendarView: () => void;
  currentLang: Language;
}

export const MyPollsList: React.FC<MyPollsListProps> = ({
  polls,
  onSelectPoll,
  onCreateNew,
  onRefreshList,
  onOpenCalendarView,
  currentLang
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);

  const filteredPolls = polls.filter(poll => 
    poll.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    poll.organizerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (poll.location && poll.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCopyLink = (poll: Poll, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = getPollShareUrl(poll);
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(poll.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDelete', currentLang))) {
      await deletePollFromFirestore(id);
      onRefreshList();
    }
  };

  // Identify expired or past polls
  const todayStr = new Date().toISOString().split('T')[0];
  const expiredPolls = polls.filter(poll => {
    if (poll.finalizedSlotId) {
      const finalizedSlot = poll.slots.find(s => s.id === poll.finalizedSlotId);
      if (finalizedSlot && finalizedSlot.date < todayStr) return true;
    }
    if (poll.slots.length > 0) {
      return poll.slots.every(s => s.date < todayStr);
    }
    return false;
  });

  const handleDeleteOldPolls = async () => {
    if (expiredPolls.length === 0) {
      alert(currentLang === 'de' ? 'Keine abgelaufenen Umfragen zum Löschen gefunden.' : 'Nessun sondaggio scaduto o passato trovato.');
      return;
    }
    if (window.confirm(`${t('confirmDeleteOld', currentLang)} (${expiredPolls.length})`)) {
      for (const p of expiredPolls) {
        await deletePollFromFirestore(p.id);
      }
      onRefreshList();
    }
  };

  const totalVotesCount = polls.reduce((acc, p) => acc + p.participants.length, 0);
  const confirmedPollsCount = polls.filter(p => p.finalizedSlotId).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in font-body">
      {/* Top Welcome Banner */}
      <div className="bg-white border border-slate-300 rounded-sm p-6 text-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="shrink-0 flex items-center">
              <img src={dnsLogoFarbe} alt="DNS Logo" className="h-[28px] w-auto object-contain" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-dns-primary">
              {t('welcomeBadge', currentLang)}
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#083845] tracking-tight">
            {t('welcomeTitle', currentLang)}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {t('welcomeSubtitle', currentLang)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={onOpenCalendarView}
            id="hero-open-calendar-btn"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs rounded-sm transition-all shrink-0"
          >
            <Calendar className="w-4 h-4 text-dns-primary" />
            <span>{t('btnCalendarView', currentLang)}</span>
          </button>

          <button
            onClick={onCreateNew}
            id="hero-create-poll-btn"
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-[#336979] text-white hover:bg-[#8EBDC4] hover:text-[#083845] font-bold text-xs rounded-sm shadow-xs transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('btnNewPoll', currentLang)}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-300 rounded-sm p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-slate-100 text-dns-primary rounded-sm">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">{t('kpiActivePolls', currentLang)}</span>
            <strong className="text-lg text-[#083845] font-heading font-extrabold">{polls.length}</strong>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-sm p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-slate-100 text-emerald-700 rounded-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">{t('kpiTotalVotes', currentLang)}</span>
            <strong className="text-lg text-[#083845] font-heading font-extrabold">{totalVotesCount}</strong>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-sm p-4 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 bg-slate-100 text-amber-700 rounded-sm">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block">{t('kpiConfirmedDates', currentLang)}</span>
            <strong className="text-lg text-[#083845] font-heading font-extrabold">{confirmedPollsCount}</strong>
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t('searchPlaceholder', currentLang)}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-semibold w-full sm:w-auto justify-between sm:justify-end">
          <span>{filteredPolls.length} {t('searchResults', currentLang)}</span>

          {expiredPolls.length > 0 && (
            <button
              onClick={handleDeleteOldPolls}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-300 text-red-800 font-bold rounded-sm transition-colors"
              title={t('confirmDeleteOld', currentLang)}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>{t('btnDeleteOldPolls', currentLang)} ({expiredPolls.length})</span>
            </button>
          )}

          <button
            onClick={onOpenCalendarView}
            className="text-dns-primary hover:underline flex items-center gap-1 font-bold"
          >
            <Calendar className="w-3.5 h-3.5" /> {t('btnCalendarView', currentLang)}
          </button>
        </div>
      </div>

      {/* Poll Cards Grid */}
      {filteredPolls.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-300 rounded-sm space-y-4">
          <Calendar className="w-12 h-12 text-slate-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-[#083845]">{t('emptyTitle', currentLang)}</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {t('emptySubtitle', currentLang)}
            </p>
          </div>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-[#336979] text-white hover:bg-[#8EBDC4] hover:text-[#083845] font-bold text-xs rounded-sm transition-all inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('btnCreateFirst', currentLang)}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPolls.map((poll) => {
            const topSlotId = getTopVotedSlot(poll.slots, poll.participants);
            const topSlot = poll.slots.find(s => s.id === (poll.finalizedSlotId || topSlotId));

            return (
              <div
                key={poll.id}
                onClick={() => onSelectPoll(poll)}
                className="bg-white border border-slate-300 hover:border-dns-primary rounded-sm p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group relative"
              >
                <div className="space-y-3">
                  {/* Status badge & Slot count */}
                  <div className="flex items-center justify-between gap-2">
                    {poll.finalizedSlotId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t('dateConfirmed', currentLang)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded-sm">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        {poll.slots.length} {t('optionsCount', currentLang)}
                      </span>
                    )}

                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {poll.participants.length} {t('votesCount', currentLang)}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#083845] group-hover:text-dns-primary transition-colors line-clamp-2">
                      {poll.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {t('organizedBy', currentLang)} <strong className="text-slate-800">{poll.organizerName}</strong>
                    </p>
                  </div>

                  {poll.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-sm border border-slate-200">
                      {poll.description}
                    </p>
                  )}

                  {/* Top / Finalized Slot Highlight */}
                  {topSlot && (
                    <div className="text-xs bg-slate-50 border border-slate-200 rounded-sm p-2 flex items-center justify-between text-slate-700">
                      <span className="font-medium truncate">
                        {t('topOption', currentLang)} <strong className="text-[#083845]">{formatDate(topSlot.date, currentLang).dayMonth}</strong> ({topSlot.time || (currentLang === 'de' ? 'Ganztägig' : 'Tutto il giorno')})
                      </span>
                      <span className="text-[10px] text-slate-600 font-mono uppercase bg-slate-200 px-1.5 py-0.5 rounded-sm">
                        {t('recommended', currentLang)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(poll, e)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-sm border border-slate-300 transition-colors font-medium"
                  >
                    {copiedId === poll.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('btnCopied', currentLang)}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('btnCopyLink', currentLang)}</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPoll(poll);
                      }}
                      className="p-1.5 text-slate-500 hover:text-amber-800 hover:bg-amber-50 rounded-sm transition-colors"
                      title={t('btnEditPoll', currentLang)}
                    >
                      <Edit3 className="w-4 h-4 text-amber-700" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(poll.id, e)}
                      className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-sm transition-colors"
                      title={t('btnDelete', currentLang)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectPoll(poll)}
                      className="flex items-center gap-1 px-3 py-1 bg-dns-primary text-white hover:bg-dns-deep font-bold rounded-sm transition-colors shadow-xs"
                    >
                      <span>{t('btnOpen', currentLang)}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Poll Modal */}
      {editingPoll && (
        <EditPollModal
          poll={editingPoll}
          isOpen={!!editingPoll}
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
