import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  Mail,
  Pencil,
  Send,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  Participant,
  ParticipantIdentity,
  Poll,
  VoteStatus,
} from '../types';
import {
  formatDate,
  getSlotVoteSummary,
  getTopVotedSlot,
} from '../utils/dateUtils';
import { Language, t } from '../utils/i18n';
import { sendParticipantVoteNotification } from '../utils/emailNotifier';

interface PollTableProps {
  poll: Poll;
  onVoteSubmit: (
    participant: ParticipantIdentity,
    votes: Record<string, VoteStatus>,
    editingParticipantId?: string,
  ) => void | Promise<void>;
  onFinalizeSlot?: (slotId: string) => void | Promise<void>;
  isOrganizerView?: boolean;
  currentLang?: Language;
}

const voteTone: Record<VoteStatus, string> = {
  yes: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  maybe: 'border-amber-300 bg-amber-50 text-amber-800',
  no: 'border-red-200 bg-red-50 text-red-800',
};

export const PollTable: React.FC<PollTableProps> = ({
  poll,
  onVoteSubmit,
  onFinalizeSlot,
  isOrganizerView = false,
  currentLang = 'de',
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [myVotes, setMyVotes] = useState<Record<string, VoteStatus>>({});
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topSlotId = getTopVotedSlot(poll.slots, poll.participants);

  const copy = currentLang === 'de'
    ? {
        availability: 'Verfügbarkeit',
        response: 'Antwort abgeben',
        responseDesc: 'Wählen Sie für jeden Termin Ihre Verfügbarkeit.',
        identity: 'Ihre Angaben',
        privacy: 'Die E-Mail-Adresse wird nur für diese Umfrage verwendet und nicht automatisch in andere Kontaktlisten übernommen.',
        firstName: 'Vorname',
        lastName: 'Nachname',
        email: 'E-Mail',
        allYes: 'Alle Ja',
        allNo: 'Alle Nein',
        selected: 'beantwortet',
        missing: 'offen',
        submit: 'Antwort senden',
        update: 'Antwort aktualisieren',
        submitting: 'Wird gespeichert…',
        teamResponses: 'Team-Antworten',
        teamResponsesDesc: 'Aktueller Stand der eingegangenen Verfügbarkeiten.',
        organizerSummary: 'Auswertung',
        organizerSummaryDesc: 'Vergleichen Sie die Termine und bestätigen Sie anschließend den endgültigen Termin.',
        edit: 'Bearbeiten',
        best: 'Beste Option',
        confirmed: 'Bestätigt',
        chooseFinal: 'Endgültigen Termin bestätigen',
        noResponses: 'Noch keine Antworten eingegangen.',
        participant: 'Teilnehmer',
        yes: 'Ja',
        maybe: 'Falls nötig',
        no: 'Nein',
        responseSaved: 'Antwort gespeichert',
      }
    : {
        availability: 'Disponibilità',
        response: 'Invia disponibilità',
        responseDesc: 'Seleziona la tua disponibilità per ogni proposta.',
        identity: 'I tuoi dati',
        privacy: 'L’indirizzo e-mail viene utilizzato solo per questo sondaggio e non viene aggiunto automaticamente ad altre liste di contatti.',
        firstName: 'Nome',
        lastName: 'Cognome',
        email: 'E-mail',
        allYes: 'Tutti sì',
        allNo: 'Tutti no',
        selected: 'compilate',
        missing: 'mancanti',
        submit: 'Invia risposta',
        update: 'Aggiorna risposta',
        submitting: 'Salvataggio…',
        teamResponses: 'Risposte del team',
        teamResponsesDesc: 'Situazione aggiornata delle disponibilità ricevute.',
        organizerSummary: 'Riepilogo disponibilità',
        organizerSummaryDesc: 'Confronta le date e conferma poi l’appuntamento definitivo.',
        edit: 'Modifica',
        best: 'Opzione migliore',
        confirmed: 'Confermata',
        chooseFinal: 'Conferma data definitiva',
        noResponses: 'Nessuna risposta ricevuta.',
        participant: 'Partecipante',
        yes: 'Sì',
        maybe: 'Se necessario',
        no: 'No',
        responseSaved: 'Risposta salvata',
      };

  const answeredSlots = Object.keys(myVotes).filter(slotId =>
    poll.slots.some(slot => slot.id === slotId),
  ).length;
  const missingSlots = Math.max(0, poll.slots.length - answeredSlots);

  const slotSummaries = useMemo(
    () =>
      poll.slots.map(slot => ({
        slot,
        summary: getSlotVoteSummary(slot.id, poll.participants),
      })),
    [poll.participants, poll.slots],
  );

  const setVote = (slotId: string, status: VoteStatus) => {
    setMyVotes(current => ({ ...current, [slotId]: status }));
    setErrorMsg('');
  };

  const handleQuickSetAll = (status: VoteStatus) => {
    const updated: Record<string, VoteStatus> = {};
    poll.slots.forEach(slot => {
      updated[slot.id] = status;
    });
    setMyVotes(updated);
    setErrorMsg('');
  };

  const resetIdentity = () => {
    setFirstName('');
    setLastName('');
    setParticipantEmail('');
    setMyVotes({});
    setEditingParticipantId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = participantEmail.trim().toLowerCase();
    const cleanName = [cleanFirstName, cleanLastName].filter(Boolean).join(' ');

    if (!cleanFirstName || !cleanLastName) {
      setErrorMsg(
        currentLang === 'de'
          ? 'Bitte Vor- und Nachname eingeben.'
          : 'Inserisci nome e cognome.',
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg(
        currentLang === 'de'
          ? 'Bitte eine gültige E-Mail-Adresse eingeben.'
          : 'Inserisci un indirizzo e-mail valido.',
      );
      return;
    }

    if (answeredSlots !== poll.slots.length) {
      setErrorMsg(
        currentLang === 'de'
          ? 'Bitte beantworten Sie alle vorgeschlagenen Termine.'
          : 'Indica la disponibilità per tutte le date proposte.',
      );
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      await onVoteSubmit(
        {
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
        },
        myVotes,
        isOrganizerView ? (editingParticipantId || undefined) : undefined,
      );

      setSubmitSuccess(true);

      const emailRes = await sendParticipantVoteNotification(
        poll,
        cleanName,
        myVotes,
        Boolean(editingParticipantId),
      );

      if (emailRes.success) {
        setEmailStatusMsg(t('emailNotifiedBadge', currentLang));
      } else {
        setEmailStatusMsg(
          currentLang === 'de'
            ? 'Antwort gespeichert.'
            : 'Risposta salvata.',
        );
      }

      window.setTimeout(() => {
        setSubmitSuccess(false);
        setEmailStatusMsg(null);
      }, 4500);

      if (!editingParticipantId) resetIdentity();
    } catch (error) {
      console.error('Vote submission failed:', error);
      setErrorMsg(
        currentLang === 'de'
          ? 'Die Antwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'
          : 'Impossibile salvare la risposta. Riprova.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditParticipant = (participant: Participant) => {
    const legacyParts = participant.name.trim().split(/\s+/);
    const legacyFirstName = legacyParts.shift() || '';

    setEditingParticipantId(participant.id);
    setFirstName(participant.firstName || legacyFirstName);
    setLastName(participant.lastName || legacyParts.join(' '));
    setParticipantEmail(participant.email || '');
    setMyVotes({ ...participant.votes });

    window.setTimeout(() => {
      document
        .getElementById('poll-response-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const renderVoteMark = (vote?: VoteStatus) => {
    if (vote === 'yes') {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800">
          <Check className="h-4 w-4" />
        </span>
      );
    }

    if (vote === 'maybe') {
      return (
        <span className="inline-flex min-h-7 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-2 font-alt text-[9px] font-semibold text-amber-800">
          {t('voteMaybe', currentLang)}
        </span>
      );
    }

    if (vote === 'no') {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-800">
          <X className="h-4 w-4" />
        </span>
      );
    }

    return <span className="font-alt text-[10px] text-dns-muted">—</span>;
  };

  const teamMatrix = (
    <section className="dns-card overflow-hidden" data-dns-reveal>
      <div className="flex flex-col justify-between gap-3 border-b border-dns-mid/10 p-5 md:flex-row md:items-start md:p-6">
        <div>
          <div className="dns-kicker">
            {isOrganizerView ? copy.organizerSummary : copy.teamResponses}
          </div>
          <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
            {isOrganizerView ? copy.organizerSummary : copy.teamResponses}
          </h2>
          <p className="mt-1 font-alt text-[10px] leading-relaxed text-dns-muted">
            {isOrganizerView ? copy.organizerSummaryDesc : copy.teamResponsesDesc}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-md border border-dns-mid/10 bg-dns-bg px-3 py-2 font-alt text-[10px] text-dns-muted">
          <Users className="h-4 w-4 text-dns-mid" />
          <strong className="text-dns-deep">{poll.participants.length}</strong>
          {t('responsesCount', currentLang)}
        </div>
      </div>

      {poll.participants.length === 0 ? (
        <div className="px-5 py-10 text-center font-alt text-[11px] text-dns-muted md:px-6">
          {copy.noResponses}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-dns-mid/10 bg-dns-bg/75">
                <th className="sticky left-0 z-20 min-w-[190px] border-r border-dns-mid/10 bg-dns-bg px-4 py-3">
                  <span className="dns-kicker">{copy.participant}</span>
                </th>

                {poll.slots.map(slot => {
                  const date = formatDate(slot.date, currentLang);
                  const isTop = topSlotId === slot.id && poll.participants.length > 0;
                  const isFinal = poll.finalizedSlotId === slot.id;

                  return (
                    <th
                      key={slot.id}
                      className={[
                        'min-w-[145px] border-r border-dns-mid/10 px-3 py-3 text-center',
                        isFinal ? 'bg-emerald-50' : '',
                        !isFinal && isTop ? 'bg-dns-light/25' : '',
                      ].join(' ')}
                    >
                      <div className="flex min-h-[76px] flex-col items-center justify-center">
                        <div className="font-alt text-[9px] font-bold uppercase tracking-[.06em] text-dns-muted">
                          {date.weekday}
                        </div>
                        <div className="mt-0.5 text-[12px] font-semibold text-dns-deep">
                          {date.dayMonth}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 font-alt text-[9px] text-dns-muted">
                          <Clock className="h-3 w-3" />
                          {slot.time || t('allDay', currentLang)}
                        </div>

                        {(isFinal || isTop) && (
                          <span
                            className={[
                              'mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-alt text-[8px] font-bold uppercase tracking-[.05em]',
                              isFinal
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                                : 'border-dns-mid/20 bg-white text-dns-mid',
                            ].join(' ')}
                          >
                            {isFinal
                              ? <CheckCircle2 className="h-3 w-3" />
                              : <Trophy className="h-3 w-3" />}
                            {isFinal ? copy.confirmed : copy.best}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>

              <tr className="border-b border-dns-mid/10 bg-white">
                <td className="sticky left-0 z-20 border-r border-dns-mid/10 bg-white px-4 py-2 font-alt text-[9px] font-bold uppercase tracking-[.05em] text-dns-muted">
                  {t('totalAvailability', currentLang)}
                </td>
                {slotSummaries.map(({ slot, summary }) => (
                  <td
                    key={`summary-${slot.id}`}
                    className="border-r border-dns-mid/10 px-3 py-2 text-center"
                  >
                    <div className="flex items-center justify-center gap-2 font-alt text-[9px]">
                      <span className="font-semibold text-emerald-800">
                        {summary.yes} {copy.yes}
                      </span>
                      {poll.allowMaybe && (
                        <span className="text-amber-800">
                          {summary.maybe} {copy.maybe}
                        </span>
                      )}
                      <span className="text-red-800">
                        {summary.no} {copy.no}
                      </span>
                    </div>
                  </td>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-dns-mid/10">
              {poll.participants.map(participant => (
                <tr key={participant.id} className="hover:bg-dns-bg/60">
                  <td className="sticky left-0 z-10 border-r border-dns-mid/10 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-dns-deep">
                          {participant.name}
                        </div>
                      </div>

                      {isOrganizerView && (
                        <button
                          type="button"
                          onClick={() => handleEditParticipant(participant)}
                          data-dns-press
                          data-dns-hover
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-dns-mid/10 bg-white text-dns-mid hover:bg-dns-bg"
                          aria-label={copy.edit}
                          title={copy.edit}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {poll.slots.map(slot => (
                    <td
                      key={`${participant.id}-${slot.id}`}
                      className="border-r border-dns-mid/10 px-3 py-3 text-center"
                    >
                      {renderVoteMark(participant.votes[slot.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const responseForm = (
    <section
      id="poll-response-form"
      className="dns-card p-5 md:p-6"
      data-dns-reveal
    >
      <div className="flex flex-col justify-between gap-3 border-b border-dns-mid/10 pb-4 sm:flex-row sm:items-start">
        <div>
          <div className="dns-kicker">{copy.response}</div>
          <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
            {editingParticipantId ? t('editResponsesLabel', currentLang) : copy.availability}
          </h2>
          <p className="mt-1 font-alt text-[10px] leading-relaxed text-dns-muted">
            {copy.responseDesc}
          </p>
        </div>

        {editingParticipantId && (
          <button
            type="button"
            onClick={resetIdentity}
            data-dns-press
            className="dns-btn-secondary min-h-8"
          >
            {currentLang === 'de' ? 'Bearbeitung abbrechen' : 'Annulla modifica'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mt-5">
          <div className="dns-kicker">{copy.identity}</div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <label>
              <span className="sr-only">{copy.firstName}</span>
              <input
                id="participant-first-name-input"
                type="text"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={event => setFirstName(event.target.value)}
                placeholder={copy.firstName}
                className="dns-input h-10 w-full"
              />
            </label>

            <label>
              <span className="sr-only">{copy.lastName}</span>
              <input
                id="participant-last-name-input"
                type="text"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={event => setLastName(event.target.value)}
                placeholder={copy.lastName}
                className="dns-input h-10 w-full"
              />
            </label>

            <label>
              <span className="sr-only">{copy.email}</span>
              <input
                id="participant-email-input"
                type="email"
                required
                autoComplete="email"
                value={participantEmail}
                onChange={event => setParticipantEmail(event.target.value)}
                placeholder={copy.email}
                className="dns-input h-10 w-full"
              />
            </label>
          </div>

          <p className="mt-2 font-alt text-[9px] leading-relaxed text-dns-muted">
            {copy.privacy}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-dns-mid/10 py-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleQuickSetAll('yes')}
              data-dns-press
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 font-alt text-[10px] font-semibold text-emerald-800"
            >
              <Check className="h-3.5 w-3.5" />
              {copy.allYes}
            </button>
            <button
              type="button"
              onClick={() => handleQuickSetAll('no')}
              data-dns-press
              className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 font-alt text-[10px] font-semibold text-red-800"
            >
              <X className="h-3.5 w-3.5" />
              {copy.allNo}
            </button>
          </div>

          <div className="font-alt text-[9px] text-dns-muted">
            <strong className="text-dns-deep">{answeredSlots}</strong> / {poll.slots.length} {copy.selected}
            {missingSlots > 0 && (
              <span className="ml-2">· {missingSlots} {copy.missing}</span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {poll.slots.map(slot => {
            const date = formatDate(slot.date, currentLang);
            const selected = myVotes[slot.id];
            const isFinal = poll.finalizedSlotId === slot.id;
            const isTop = topSlotId === slot.id && poll.participants.length > 0;

            const options: Array<{
              status: VoteStatus;
              label: string;
              icon: React.ReactNode;
            }> = [
              {
                status: 'yes',
                label: copy.yes,
                icon: <Check className="h-4 w-4" />,
              },
              ...(poll.allowMaybe
                ? [{
                    status: 'maybe' as const,
                    label: copy.maybe,
                    icon: <HelpCircle className="h-4 w-4" />,
                  }]
                : []),
              {
                status: 'no',
                label: copy.no,
                icon: <X className="h-4 w-4" />,
              },
            ];

            return (
              <fieldset
                key={slot.id}
                className={[
                  'rounded-lg border p-4',
                  isFinal
                    ? 'border-emerald-300 bg-emerald-50/45'
                    : 'border-dns-mid/10 bg-white',
                ].join(' ')}
              >
                <legend className="sr-only">
                  {date.fullFormatted} {slot.time || t('allDay', currentLang)}
                </legend>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-alt text-[9px] font-bold uppercase tracking-[.06em] text-dns-muted">
                      {date.weekday}
                    </div>
                    <div className="mt-0.5 text-[13px] font-semibold text-dns-deep">
                      {date.dayMonth}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 font-alt text-[10px] text-dns-muted">
                      <Clock className="h-3.5 w-3.5" />
                      {slot.time || t('allDay', currentLang)}
                    </div>
                  </div>

                  {(isFinal || isTop) && (
                    <span
                      className={[
                        'inline-flex items-center gap-1 rounded-full border px-2 py-1 font-alt text-[8px] font-bold uppercase tracking-[.05em]',
                        isFinal
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                          : 'border-dns-mid/20 bg-dns-bg text-dns-mid',
                      ].join(' ')}
                    >
                      {isFinal
                        ? <CheckCircle2 className="h-3 w-3" />
                        : <Trophy className="h-3 w-3" />}
                      {isFinal ? copy.confirmed : copy.best}
                    </span>
                  )}
                </div>

                <div
                  className={[
                    'mt-4 grid gap-2',
                    poll.allowMaybe ? 'grid-cols-3' : 'grid-cols-2',
                  ].join(' ')}
                >
                  {options.map(option => (
                    <button
                      key={option.status}
                      type="button"
                      onClick={() => setVote(slot.id, option.status)}
                      data-dns-press
                      aria-pressed={selected === option.status}
                      className={[
                        'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-2 font-alt text-[10px] font-semibold transition-colors',
                        selected === option.status
                          ? voteTone[option.status]
                          : 'border-dns-mid/15 bg-white text-dns-muted hover:bg-dns-bg',
                      ].join(' ')}
                    >
                      {option.icon}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        {(errorMsg || submitSuccess) && (
          <div
            className={[
              'mt-4 flex items-start gap-2 rounded-md border px-3 py-2 font-alt text-[10px]',
              errorMsg
                ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800',
            ].join(' ')}
            role={errorMsg ? 'alert' : 'status'}
          >
            {errorMsg
              ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <div className="font-semibold">
                {errorMsg || copy.responseSaved}
              </div>
              {submitSuccess && emailStatusMsg && (
                <div className="mt-0.5 flex items-center gap-1 text-[9px]">
                  <Mail className="h-3 w-3" />
                  {emailStatusMsg}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            id="submit-vote-btn"
            type="submit"
            disabled={isSubmitting}
            data-dns-press
            className="dns-btn-primary min-h-10 min-w-[180px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting
              ? copy.submitting
              : editingParticipantId
                ? copy.update
                : copy.submit}
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );

  const organizerFinalize = isOrganizerView && onFinalizeSlot && (
    <section className="dns-card p-5 md:p-6" data-dns-reveal>
      <div className="dns-kicker">{t('organizerPanelTitle', currentLang)}</div>
      <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
        {copy.chooseFinal}
      </h2>
      <p className="mt-1 font-alt text-[10px] leading-relaxed text-dns-muted">
        {t('organizerPanelDesc', currentLang)}
      </p>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {slotSummaries.map(({ slot, summary }) => {
          const date = formatDate(slot.date, currentLang);
          const isSelected = poll.finalizedSlotId === slot.id;
          const isTop = topSlotId === slot.id && poll.participants.length > 0;

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => void onFinalizeSlot(slot.id)}
              data-dns-press
              className={[
                'flex min-h-[72px] items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors',
                isSelected
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-dns-mid/15 bg-white hover:bg-dns-bg',
              ].join(' ')}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-dns-deep">
                    {date.dayMonth}
                  </span>
                  {isTop && !isSelected && (
                    <Trophy className="h-3.5 w-3.5 text-dns-mid" />
                  )}
                  {isSelected && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 font-alt text-[9px] text-dns-muted">
                  <Clock className="h-3 w-3" />
                  {slot.time || t('allDay', currentLang)}
                </div>
              </div>

              <div className="text-right font-alt text-[9px] text-dns-muted">
                <div>
                  <strong className="text-emerald-800">{summary.yes}</strong> {copy.yes}
                </div>
                {poll.allowMaybe && (
                  <div>
                    <strong className="text-amber-800">{summary.maybe}</strong> {copy.maybe}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  if (isOrganizerView) {
    return (
      <div className="space-y-5">
        {teamMatrix}
        {responseForm}
        {organizerFinalize}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {responseForm}
      {teamMatrix}
    </div>
  );
};
