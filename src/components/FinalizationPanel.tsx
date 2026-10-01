import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Link2,
  MapPin,
  RotateCcw,
  Save,
  Trophy,
  Users,
} from 'lucide-react';
import { Poll } from '../types';
import {
  formatDate,
  getSlotVoteSummary,
  getTopVotedSlot,
} from '../utils/dateUtils';
import { savePollToFirestore } from '../utils/firebaseStorage';
import { Language, t } from '../utils/i18n';
import { generateICalFile } from '../utils/ical';
import {
  formatPollRecipients,
  getPollRecipients,
  parseRecipientEmails,
  savePollRecipients,
} from '../utils/pollRecipientStore';

interface FinalizationPanelProps {
  poll: Poll;
  currentLang: Language;
  onFinalizeSlot: (slotId: string) => void | Promise<void>;
  onPollUpdated: (poll: Poll) => void;
}

export const FinalizationPanel: React.FC<FinalizationPanelProps> = ({
  poll,
  currentLang,
  onFinalizeSlot,
  onPollUpdated,
}) => {
  const topSlotId = getTopVotedSlot(poll.slots, poll.participants);
  const [selectedSlotId, setSelectedSlotId] = useState(
    poll.finalizedSlotId || topSlotId || poll.slots[0]?.id || '',
  );
  const [conferenceUrl, setConferenceUrl] = useState(poll.conferenceUrl || '');
  const [recipientInput, setRecipientInput] = useState(() =>
    formatPollRecipients(getPollRecipients(poll.id)),
  );
  const [recipientsSaved, setRecipientsSaved] = useState(false);
  const [conferenceSaved, setConferenceSaved] = useState(false);
  const [isSavingConference, setIsSavingConference] = useState(false);
  const [copiedRecipients, setCopiedRecipients] = useState(false);

  const copy = currentLang === 'de'
    ? {
        kicker: '04 · Abschluss',
        title: 'Termin finalisieren',
        desc: 'Wählen Sie den endgültigen Termin. Danach können Sie die Outlook-/ICS-Einladung vorbereiten.',
        best: 'Beste Option',
        confirmed: 'Bestätigt',
        yes: 'Ja',
        maybe: 'Falls nötig',
        no: 'Nein',
        confirm: 'Termin bestätigen',
        change: 'Neuen Termin bestätigen',
        reopen: 'Umfrage wieder öffnen',
        confirmQuestion: 'Diesen Termin endgültig bestätigen?',
        reopenQuestion: 'Bestätigten Termin entfernen und die Umfrage wieder öffnen?',
        event: 'Kalendereinladung',
        inPerson: 'Vor Ort',
        online: 'Online',
        meetingType: 'Terminart',
        location: 'Ort',
        conference: 'Videokonferenz-Link',
        conferenceHint: 'Für Online-Termine wird der Link in die ICS-Datei übernommen.',
        saveLink: 'Link speichern',
        saved: 'Gespeichert',
        recipients: 'Empfänger für Outlook',
        recipientsHint: 'Eine E-Mail pro Zeile oder durch Komma/Semikolon getrennt. Diese Liste bleibt nur in diesem Browser und wird nicht in Firestore gespeichert.',
        saveRecipients: 'Empfänger speichern',
        copyRecipients: 'E-Mails kopieren',
        recipientsSaved: 'Empfänger gespeichert',
        attendees: 'Teilnehmer',
        noAttendees: 'Keine Empfänger hinterlegt',
        download: 'ICS für Outlook herunterladen',
        downloadHint: 'Die ICS-Datei enthält Termin, Ort/Link, Organisator und die lokal hinterlegten Empfänger.',
      }
    : {
        kicker: '04 · Finalizzazione',
        title: 'Finalizza appuntamento',
        desc: 'Scegli la data definitiva. Dopo la conferma puoi preparare l’invito Outlook/ICS.',
        best: 'Opzione migliore',
        confirmed: 'Confermata',
        yes: 'Sì',
        maybe: 'Se necessario',
        no: 'No',
        confirm: 'Conferma data',
        change: 'Conferma nuova data',
        reopen: 'Riapri sondaggio',
        confirmQuestion: 'Confermare definitivamente questa data?',
        reopenQuestion: 'Rimuovere la data confermata e riaprire il sondaggio?',
        event: 'Invito calendario',
        inPerson: 'In presenza',
        online: 'Online',
        meetingType: 'Tipo appuntamento',
        location: 'Luogo',
        conference: 'Link videoconferenza',
        conferenceHint: 'Per gli appuntamenti online il link viene inserito nel file ICS.',
        saveLink: 'Salva link',
        saved: 'Salvato',
        recipients: 'Destinatari per Outlook',
        recipientsHint: 'Una e-mail per riga oppure separate da virgola/punto e virgola. La lista resta solo in questo browser e non viene salvata su Firestore.',
        saveRecipients: 'Salva destinatari',
        copyRecipients: 'Copia e-mail',
        recipientsSaved: 'Destinatari salvati',
        attendees: 'destinatari',
        noAttendees: 'Nessun destinatario salvato',
        download: 'Scarica ICS per Outlook',
        downloadHint: 'Il file ICS contiene data, luogo/link, organizzatore e i destinatari salvati localmente.',
      };

  useEffect(() => {
    if (poll.finalizedSlotId) {
      setSelectedSlotId(poll.finalizedSlotId);
    } else if (!selectedSlotId && poll.slots.length > 0) {
      setSelectedSlotId(topSlotId || poll.slots[0].id);
    }
  }, [poll.finalizedSlotId, poll.slots, selectedSlotId, topSlotId]);

  useEffect(() => {
    setConferenceUrl(poll.conferenceUrl || '');
  }, [poll.conferenceUrl]);

  useEffect(() => {
    setRecipientInput(formatPollRecipients(getPollRecipients(poll.id)));
  }, [poll.id]);

  const selectedSlot = poll.slots.find(slot => slot.id === selectedSlotId);
  const validRecipients = useMemo(
    () => parseRecipientEmails(recipientInput),
    [recipientInput],
  );

  const isOnlineMeeting =
    /online|teams|zoom|meet|videokonferenz|video.?conference/i.test(
      poll.location || '',
    ) ||
    /^https?:\/\//i.test(poll.location || '') ||
    Boolean(conferenceUrl.trim());

  const handleFinalize = async () => {
    if (!selectedSlotId) return;

    const question =
      poll.finalizedSlotId === selectedSlotId
        ? copy.reopenQuestion
        : copy.confirmQuestion;

    if (!window.confirm(question)) return;

    await onFinalizeSlot(selectedSlotId);
  };

  const handleSaveConference = async () => {
    const raw = conferenceUrl.trim();
    const normalized =
      raw && !/^https?:\/\//i.test(raw)
        ? `https://${raw}`
        : raw;

    setIsSavingConference(true);

    try {
      const updated: Poll = {
        ...poll,
        conferenceUrl: normalized || undefined,
      };

      await savePollToFirestore(updated);
      setConferenceUrl(normalized);
      setConferenceSaved(true);
      onPollUpdated(updated);

      window.setTimeout(() => setConferenceSaved(false), 1800);
    } finally {
      setIsSavingConference(false);
    }
  };

  const handleSaveRecipients = () => {
    const saved = savePollRecipients(poll.id, recipientInput);
    setRecipientInput(formatPollRecipients(saved));
    setRecipientsSaved(true);
    window.setTimeout(() => setRecipientsSaved(false), 1800);
  };

  const handleCopyRecipients = async () => {
    if (validRecipients.length === 0) return;
    await navigator.clipboard.writeText(validRecipients.join('; '));
    setCopiedRecipients(true);
    window.setTimeout(() => setCopiedRecipients(false), 1800);
  };

  const handleDownload = () => {
    if (!poll.finalizedSlotId) return;

    const recipients = savePollRecipients(poll.id, recipientInput);

    generateICalFile(
      {
        ...poll,
        conferenceUrl: conferenceUrl.trim() || poll.conferenceUrl,
      },
      poll.finalizedSlotId,
      {
        lang: currentLang,
        attendeeEmails: recipients,
      },
    );
  };

  return (
    <section className="dns-card p-5 md:p-6" data-dns-reveal>
      <div className="border-b border-dns-mid/10 pb-4">
        <div className="dns-kicker">{copy.kicker}</div>
        <h2 className="mt-1 text-[18px] font-semibold text-dns-deep">
          {copy.title}
        </h2>
        <p className="mt-1 max-w-2xl font-alt text-[10px] leading-relaxed text-dns-muted">
          {copy.desc}
        </p>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {poll.slots.map(slot => {
          const date = formatDate(slot.date, currentLang);
          const summary = getSlotVoteSummary(slot.id, poll.participants);
          const isTop = topSlotId === slot.id && poll.participants.length > 0;
          const isFinal = poll.finalizedSlotId === slot.id;
          const isSelected = selectedSlotId === slot.id;

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => setSelectedSlotId(slot.id)}
              data-dns-press
              aria-pressed={isSelected}
              className={[
                'flex min-h-[92px] items-center justify-between gap-4 rounded-lg border p-4 text-left transition-colors',
                isSelected
                  ? 'border-dns-mid bg-dns-light/25'
                  : 'border-dns-mid/10 bg-white hover:bg-dns-bg',
                isFinal ? 'ring-1 ring-emerald-400' : '',
              ].join(' ')}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-dns-deep">
                    {date.fullFormatted}
                  </span>

                  {isTop && !isFinal && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-dns-mid/15 bg-dns-bg px-2 py-0.5 font-alt text-[8px] font-bold uppercase tracking-[.05em] text-dns-mid">
                      <Trophy className="h-3 w-3" />
                      {copy.best}
                    </span>
                  )}

                  {isFinal && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-alt text-[8px] font-bold uppercase tracking-[.05em] text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      {copy.confirmed}
                    </span>
                  )}
                </div>

                <div className="mt-1 inline-flex items-center gap-1 font-alt text-[10px] text-dns-muted">
                  <Clock className="h-3.5 w-3.5" />
                  {slot.time || t('allDay', currentLang)}
                </div>
              </div>

              <div className="shrink-0 text-right font-alt text-[9px] text-dns-muted">
                <div>
                  <strong className="text-emerald-800">{summary.yes}</strong> {copy.yes}
                </div>
                {poll.allowMaybe && (
                  <div>
                    <strong className="text-amber-800">{summary.maybe}</strong> {copy.maybe}
                  </div>
                )}
                <div>
                  <strong className="text-red-800">{summary.no}</strong> {copy.no}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSlot && (
        <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-dns-mid/10 bg-dns-bg p-4 sm:flex-row sm:items-center">
          <div>
            <div className="dns-kicker">
              {poll.finalizedSlotId === selectedSlotId
                ? copy.confirmed
                : copy.title}
            </div>
            <div className="mt-1 text-[11px] font-semibold text-dns-deep">
              {formatDate(selectedSlot.date, currentLang).fullFormatted}
              {' · '}
              {selectedSlot.time || t('allDay', currentLang)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleFinalize()}
            data-dns-press
            className={
              poll.finalizedSlotId === selectedSlotId
                ? 'dns-btn-secondary min-h-9'
                : 'dns-btn-primary min-h-9'
            }
          >
            {poll.finalizedSlotId === selectedSlotId
              ? <RotateCcw className="h-4 w-4" />
              : <CalendarCheck2 className="h-4 w-4" />}
            {poll.finalizedSlotId === selectedSlotId
              ? copy.reopen
              : poll.finalizedSlotId
                ? copy.change
                : copy.confirm}
          </button>
        </div>
      )}

      {poll.finalizedSlotId && (
        <div className="mt-6 border-t border-dns-mid/10 pt-5">
          <div className="dns-kicker">{copy.event}</div>

          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-dns-mid/10 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="dns-kicker">{copy.meetingType}</div>
                  <div className="mt-1 text-[11px] font-semibold text-dns-deep">
                    {isOnlineMeeting ? copy.online : copy.inPerson}
                  </div>
                </div>

                <div>
                  <div className="dns-kicker">{copy.location}</div>
                  <div className="mt-1 flex items-start gap-1.5 font-alt text-[10px] text-dns-deep">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dns-mid" />
                    <span>{poll.location || '—'}</span>
                  </div>
                </div>
              </div>

              {isOnlineMeeting && (
                <div className="mt-4 border-t border-dns-mid/10 pt-4">
                  <label>
                    <span className="flex items-center gap-1.5 dns-kicker">
                      <Link2 className="h-3.5 w-3.5" />
                      {copy.conference}
                    </span>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="url"
                        value={conferenceUrl}
                        onChange={event => {
                          setConferenceUrl(event.target.value);
                          setConferenceSaved(false);
                        }}
                        placeholder="https://..."
                        className="dns-input h-10 min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveConference()}
                        disabled={isSavingConference}
                        data-dns-press
                        className="dns-btn-secondary min-h-10 shrink-0 disabled:opacity-50"
                      >
                        {conferenceSaved
                          ? <Check className="h-4 w-4" />
                          : <Save className="h-4 w-4" />}
                        {conferenceSaved ? copy.saved : copy.saveLink}
                      </button>
                    </div>
                  </label>

                  <p className="mt-2 font-alt text-[9px] leading-relaxed text-dns-muted">
                    {copy.conferenceHint}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-dns-mid/10 bg-white p-4">
              <label>
                <span className="flex items-center gap-1.5 dns-kicker">
                  <Users className="h-3.5 w-3.5" />
                  {copy.recipients}
                </span>
                <textarea
                  rows={5}
                  value={recipientInput}
                  onChange={event => {
                    setRecipientInput(event.target.value);
                    setRecipientsSaved(false);
                  }}
                  placeholder="name@example.com"
                  className="dns-input mt-1.5 w-full resize-y font-mono text-[10px]"
                />
              </label>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-alt text-[9px] text-dns-muted">
                  {validRecipients.length > 0
                    ? `${validRecipients.length} ${copy.attendees}`
                    : copy.noAttendees}
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyRecipients()}
                    disabled={validRecipients.length === 0}
                    data-dns-press
                    className="dns-btn-secondary min-h-8 disabled:opacity-40"
                  >
                    {copiedRecipients
                      ? <Check className="h-3.5 w-3.5" />
                      : <Copy className="h-3.5 w-3.5" />}
                    {copy.copyRecipients}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveRecipients}
                    data-dns-press
                    className="dns-btn-secondary min-h-8"
                  >
                    {recipientsSaved
                      ? <Check className="h-3.5 w-3.5" />
                      : <Save className="h-3.5 w-3.5" />}
                    {recipientsSaved ? copy.recipientsSaved : copy.saveRecipients}
                  </button>
                </div>
              </div>

              <p className="mt-2 font-alt text-[9px] leading-relaxed text-dns-muted">
                {copy.recipientsHint}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-3 rounded-lg border border-dns-mid/10 bg-dns-bg p-4 sm:flex-row sm:items-center">
            <p className="max-w-2xl font-alt text-[9px] leading-relaxed text-dns-muted">
              {copy.downloadHint}
            </p>

            <button
              type="button"
              onClick={handleDownload}
              data-dns-press
              className="dns-btn-primary min-h-10 shrink-0"
            >
              <Download className="h-4 w-4" />
              {copy.download}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
