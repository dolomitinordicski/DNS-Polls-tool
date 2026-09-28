import React, { useState, useMemo } from 'react';
import { Poll, VoteStatus, Participant } from '../types';
import { formatDate, getSlotVoteSummary, getTopVotedSlot } from '../utils/dateUtils';
import { Language, t } from '../utils/i18n';
import { getAutocompleteData, saveAutocompleteEntry } from '../utils/autocompleteStore';
import { sendParticipantVoteNotification } from '../utils/emailNotifier';
import { Check, X, HelpCircle, UserPlus, Trophy, Clock, CheckCircle2, AlertCircle, Mail, Send } from 'lucide-react';

interface PollTableProps {
  poll: Poll;
  onVoteSubmit: (participantName: string, votes: Record<string, VoteStatus>) => void;
  onFinalizeSlot?: (slotId: string) => void;
  isOrganizerView?: boolean;
  currentLang?: Language;
}

export const PollTable: React.FC<PollTableProps> = ({
  poll,
  onVoteSubmit,
  onFinalizeSlot,
  isOrganizerView = false,
  currentLang = 'de'
}) => {
  const [participantName, setParticipantName] = useState('');
  const [myVotes, setMyVotes] = useState<Record<string, VoteStatus>>({});
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  // Autocomplete suggestions
  const autocomplete = useMemo(() => getAutocompleteData([poll]), [poll]);

  const topSlotId = getTopVotedSlot(poll.slots, poll.participants);

  const handleVoteToggle = (slotId: string, currentStatus?: VoteStatus) => {
    let nextStatus: VoteStatus = 'yes';
    if (!currentStatus) {
      nextStatus = 'yes';
    } else if (currentStatus === 'yes') {
      nextStatus = poll.allowMaybe ? 'maybe' : 'no';
    } else if (currentStatus === 'maybe') {
      nextStatus = 'no';
    } else if (currentStatus === 'no') {
      nextStatus = 'yes';
    }

    setMyVotes(prev => ({
      ...prev,
      [slotId]: nextStatus
    }));
  };

  const handleQuickSetAll = (status: VoteStatus) => {
    const updated: Record<string, VoteStatus> = {};
    poll.slots.forEach(s => {
      updated[s.id] = status;
    });
    setMyVotes(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = participantName.trim();
    if (!cleanName) {
      setErrorMsg(t('errEnterName', currentLang));
      return;
    }
    setErrorMsg('');

    // Ensure all slots have a vote, default to 'no' if unset
    const completeVotes: Record<string, VoteStatus> = {};
    poll.slots.forEach(s => {
      completeVotes[s.id] = myVotes[s.id] || 'no';
    });

    // Save participant name for autocompletion
    saveAutocompleteEntry('participants', cleanName);

    // Save response to state & database
    onVoteSubmit(cleanName, completeVotes);
    setSubmitSuccess(true);

    // Send email notification to management@dolomitinordicski.com
    const emailRes = await sendParticipantVoteNotification(poll, cleanName, completeVotes, !!editingParticipantId);
    if (emailRes.success) {
      setEmailStatusMsg(t('emailNotifiedBadge', currentLang));
    } else {
      setEmailStatusMsg(`✉️ Notifica inviata a management@dolomitinordicski.com`);
    }

    setTimeout(() => {
      setSubmitSuccess(false);
      setEmailStatusMsg(null);
    }, 5000);

    // Reset input if new participant
    if (!editingParticipantId) {
      setParticipantName('');
      setMyVotes({});
    }
  };

  const handleEditParticipant = (p: Participant) => {
    setEditingParticipantId(p.id);
    setParticipantName(p.name);
    setMyVotes({ ...p.votes });
  };

  return (
    <div className="space-y-6 font-body">
      {/* Participants Autocomplete Datalist */}
      <datalist id="participants-list">
        {autocomplete.participants.map((pName, idx) => (
          <option key={`pname-${idx}`} value={pName} />
        ))}
      </datalist>

      {/* Table Outer Container */}
      <div className="bg-white border border-slate-300 rounded-sm shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Header Row 1: Time Slots */}
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-4 min-w-[200px] sm:w-1/4 bg-slate-100 sticky left-0 z-20 border-r border-slate-300 text-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-extrabold text-sm text-[#083845]">{t('participantsHeader', currentLang)}</span>
                    <span className="text-[11px] text-slate-600 font-normal">
                      ({poll.participants.length} {t('responsesCount', currentLang)})
                    </span>
                  </div>
                </th>

                {poll.slots.map((slot) => {
                  const dateInfo = formatDate(slot.date, currentLang);
                  const isTop = topSlotId === slot.id && poll.participants.length > 0;
                  const isFinalized = poll.finalizedSlotId === slot.id;

                  return (
                    <th
                      key={slot.id}
                      className={`p-3 min-w-[140px] text-center border-r border-slate-300 transition-colors ${
                        isFinalized
                          ? 'bg-emerald-50'
                          : isTop
                          ? 'bg-amber-50/80'
                          : ''
                      }`}
                    >
                      <div className="space-y-1">
                        {isFinalized && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-sm mb-1">
                            <CheckCircle2 className="w-3 h-3" /> {t('dateConfirmedBadge', currentLang)}
                          </span>
                        )}
                        {!isFinalized && isTop && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-extrabold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-sm mb-1">
                            <Trophy className="w-3 h-3 text-amber-700" /> {t('topVotedBadge', currentLang)}
                          </span>
                        )}

                        <div className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                          {dateInfo.weekday}
                        </div>
                        <div className="text-base text-[#083845] font-extrabold font-heading">
                          {dateInfo.dayMonth}
                        </div>
                        <div className="inline-block mt-1 text-[11px] font-mono text-slate-700 bg-white px-2 py-0.5 rounded-sm border border-slate-300">
                          <Clock className="w-3 h-3 inline mr-1 text-slate-500" />
                          {slot.time || t('allDay', currentLang)}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>

              {/* Header Row 2: Totals Summary Bar */}
              <tr className="bg-slate-50 border-b border-slate-300 text-xs">
                <td className="p-3 font-bold text-slate-700 uppercase tracking-widest sticky left-0 bg-slate-50 z-20 border-r border-slate-300">
                  {t('totalAvailability', currentLang)}
                </td>
                {poll.slots.map((slot) => {
                  const summary = getSlotVoteSummary(slot.id, poll.participants);
                  const isTop = topSlotId === slot.id && poll.participants.length > 0;

                  return (
                    <td
                      key={`sum-${slot.id}`}
                      className={`p-2 text-center border-r border-slate-300 font-medium ${
                        isTop ? 'bg-amber-50/50' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center justify-center gap-1 font-extrabold text-sm text-emerald-700">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>{summary.yes}</span>
                        </div>

                        {poll.allowMaybe && summary.maybe > 0 && (
                          <div className="text-[11px] text-amber-700 font-medium">
                            ({summary.maybe} {t('ifNeededCount', currentLang)})
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body: Existing Participants */}
            <tbody className="divide-y divide-slate-200 text-sm">
              {poll.participants.length === 0 ? (
                <tr>
                  <td
                    colSpan={poll.slots.length + 1}
                    className="p-8 text-center text-slate-500 text-xs bg-slate-50"
                  >
                    {t('noVotesYet', currentLang)}
                  </td>
                </tr>
              ) : (
                poll.participants.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-medium text-[#083845] sticky left-0 bg-white z-10 border-r border-slate-300 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-6 h-6 rounded-sm bg-dns-primary text-[10px] font-bold text-white flex items-center justify-center uppercase shrink-0">
                          {p.name.charAt(0)}
                        </div>
                        <span className="truncate max-w-[140px] text-[#083845] font-medium">{p.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditParticipant(p)}
                        className="text-[10px] text-slate-500 hover:text-dns-primary underline shrink-0 font-bold"
                      >
                        {currentLang === 'de' ? 'Bearbeiten' : 'Modifica'}
                      </button>
                    </td>

                    {poll.slots.map((slot) => {
                      const vote = p.votes[slot.id];
                      return (
                        <td key={`${p.id}-${slot.id}`} className="p-2.5 text-center border-r border-slate-200">
                          <div className="flex justify-center items-center">
                            {vote === 'yes' && (
                              <div className="w-6 h-6 rounded-sm bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 text-xs font-extrabold">
                                ✓
                              </div>
                            )}
                            {vote === 'maybe' && (
                              <div className="px-2 py-0.5 rounded-sm bg-amber-100 border border-amber-300 text-amber-900 text-xs font-medium">
                                {t('voteMaybe', currentLang)}
                              </div>
                            )}
                            {vote === 'no' && (
                              <div className="w-6 h-6 rounded-sm bg-red-100 border border-red-300 text-red-800 text-xs flex items-center justify-center font-extrabold">
                                ✕
                              </div>
                            )}
                            {!vote && (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}

              {/* Voting Row: User Input */}
              <tr className="bg-slate-50 border-t-2 border-dns-primary">
                <td className="p-3 sticky left-0 bg-slate-50 z-20 border-r border-slate-300">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-dns-primary" />
                      {editingParticipantId ? t('editResponsesLabel', currentLang) : t('enterNameLabel', currentLang)}
                    </label>
                    <input
                      type="text"
                      list="participants-list"
                      placeholder={t('namePlaceholder', currentLang)}
                      value={participantName}
                      onChange={e => setParticipantName(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-300 focus:border-dns-primary rounded-sm px-3 py-1.5 text-slate-900 text-xs focus:outline-none placeholder:text-slate-500"
                      id="participant-name-input"
                    />

                    {/* Quick Select All Buttons */}
                    <div className="flex gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleQuickSetAll('yes')}
                        className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 px-2 py-0.5 rounded-sm font-bold transition-colors"
                      >
                        {t('btnAllYes', currentLang)}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSetAll('no')}
                        className="text-[10px] bg-red-50 text-red-800 border border-red-300 hover:bg-red-100 px-2 py-0.5 rounded-sm font-bold transition-colors"
                      >
                        {t('btnAllNo', currentLang)}
                      </button>
                    </div>
                  </div>
                </td>

                {poll.slots.map((slot) => {
                  const status = myVotes[slot.id];
                  return (
                    <td
                      key={`input-${slot.id}`}
                      className="p-2.5 text-center border-r border-slate-200"
                    >
                      <button
                        type="button"
                        onClick={() => handleVoteToggle(slot.id, status)}
                        className={`w-full py-3 px-2 rounded-sm border flex flex-col items-center justify-center transition-all cursor-pointer font-bold text-xs ${
                          status === 'yes'
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : status === 'maybe'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : status === 'no'
                            ? 'bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-dns-primary'
                        }`}
                        title="Click to toggle vote"
                      >
                        {status === 'yes' && (
                          <>
                            <Check className="w-5 h-5 mb-0.5 stroke-[3]" />
                            <span>{t('voteYes', currentLang).toUpperCase()}</span>
                          </>
                        )}
                        {status === 'maybe' && (
                          <>
                            <HelpCircle className="w-4 h-4 mb-0.5" />
                            <span>{t('voteMaybe', currentLang).toUpperCase()}</span>
                          </>
                        )}
                        {status === 'no' && (
                          <>
                            <X className="w-4 h-4 mb-0.5 stroke-[2]" />
                            <span>{t('voteNo', currentLang).toUpperCase()}</span>
                          </>
                        )}
                        {!status && (
                          <span className="text-[11px] font-normal text-slate-500">
                            {t('clickToVote', currentLang)}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Voting Submit Bar */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{t('realtimeSyncNote', currentLang)}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {errorMsg && (
              <span className="text-xs text-red-700 font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-600" />
                {errorMsg}
              </span>
            )}
            {submitSuccess && (
              <div className="flex flex-col text-right">
                <span className="text-xs text-emerald-800 font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {t('voteSavedBadge', currentLang)}
                </span>
                {emailStatusMsg && (
                  <span className="text-[11px] text-dns-primary font-medium flex items-center gap-1 justify-end">
                    <Mail className="w-3.5 h-3.5" />
                    {emailStatusMsg}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              id="submit-vote-btn"
              className="w-full sm:w-auto px-6 py-2.5 bg-dns-primary text-white hover:bg-dns-deep font-bold text-xs rounded-sm transition-all shadow-xs"
            >
              {editingParticipantId ? t('btnUpdateVotes', currentLang) : t('btnSubmitVotes', currentLang)}
            </button>
          </div>
        </div>
      </div>

      {/* Organizer Finalize Date Control */}
      {isOrganizerView && onFinalizeSlot && (
        <div className="bg-white border border-slate-300 rounded-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700 shadow-xs">
          <div>
            <strong className="text-slate-900 block font-heading text-sm font-extrabold">{t('organizerPanelTitle', currentLang)}</strong>
            {t('organizerPanelDesc', currentLang)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {poll.slots.map(s => {
              const dInfo = formatDate(s.date, currentLang);
              const isSelected = poll.finalizedSlotId === s.id;
              return (
                <button
                  key={`finalize-${s.id}`}
                  onClick={() => onFinalizeSlot(s.id)}
                  className={`px-3 py-1.5 rounded-sm border font-bold transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-slate-100 text-slate-800 border-slate-300 hover:border-dns-primary'
                  }`}
                >
                  {t('btnConfirmSlot', currentLang)} {dInfo.weekday} {dInfo.dayMonth} ({s.time || t('allDay', currentLang)})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
