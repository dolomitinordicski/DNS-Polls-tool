import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Link,
  Loader2,
  Mail,
  MessageCircle,
  QrCode,
  Save,
  Share2,
  Users,
  X,
} from 'lucide-react';
import { Poll } from '../types';
import { getPollShareUrl } from '../utils/firebaseStorage';
import { generateTinyUrl } from '../utils/storage';
import { Language, t } from '../utils/i18n';
import {
  formatPollRecipients,
  getPollRecipients,
  loadPollRecipientsSynced,
  parseRecipientEmails,
  savePollRecipientsSynced,
} from '../utils/pollRecipientStore';
import { useAccessibleDialog } from '../lib/useAccessibleDialog';
import { PrivateRecipientSyncControl } from './PrivateRecipientSyncControl';
import { dnsPollsCapabilities } from '../lib/foundation';

interface ShareModalProps {
  poll: Poll;
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  poll,
  isOpen,
  onClose,
  currentLang = 'de',
}) => {
  const dialogRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [loadingShort, setLoadingShort] = useState(false);
  const [recipientInput, setRecipientInput] = useState('');
  const [recipientsSaved, setRecipientsSaved] = useState(false);

  useAccessibleDialog({
    isOpen,
    onClose,
    dialogRef,
    initialFocusSelector: '#share-modal-close-btn',
  });

  useEffect(() => {
    if (!isOpen) return;

    setRecipientInput(formatPollRecipients(getPollRecipients(poll.id)));
    void loadPollRecipientsSynced(poll.id).then(({ emails }) => {
      setRecipientInput(formatPollRecipients(emails));
    });
    setShortUrl(null);
    setCopied(false);
    setCopiedShort(false);
    setRecipientsSaved(false);
    setShowQr(false);
  }, [isOpen, poll.id]);

  if (!isOpen) return null;

  const shareUrl = getPollShareUrl(poll);
  const recipients = parseRecipientEmails(recipientInput);

  const copy = currentLang === 'de'
    ? {
        direct: 'Direkter Link zur Teilnahme',
        short: 'Kurzlink',
        recipients: 'Empfänger dieser Umfrage',
        recipientsHint: 'Lokal immer verfügbar. Mit privatem Cloud-Sync werden die Adressen geschützt in Firestore gespeichert und auf anderen angemeldeten Browsern wieder geladen.',
        saveRecipients: 'Empfänger speichern',
        saved: 'Gespeichert',
        quickShare: 'Schnell teilen',
        qr: 'QR-Code',
        close: 'Dialog schließen',
        qrAlt: `QR-Code für die Umfrage „${poll.title}“`,
      }
    : {
        direct: 'Link diretto per rispondere',
        short: 'Link breve',
        recipients: 'Destinatari del sondaggio',
        recipientsHint: 'Sempre disponibili in locale. Con il sync cloud privato gli indirizzi vengono salvati in modo protetto su Firestore e ricaricati sugli altri browser autenticati.',
        saveRecipients: 'Salva destinatari',
        saved: 'Salvato',
        quickShare: 'Condivisione rapida',
        qr: 'Codice QR',
        close: 'Chiudi finestra',
        qrAlt: `Codice QR per il sondaggio “${poll.title}”`,
      };

  const handleCopy = async () => {
    try {
      await dnsPollsCapabilities.run('clipboard.copy', { text: shareUrl });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleGenerateAndCopyShortUrl = async () => {
    try {
      const value = shortUrl || await generateTinyUrl(shareUrl);
      setShortUrl(value);
      await dnsPollsCapabilities.run('clipboard.copy', { text: value });
      setCopiedShort(true);
      window.setTimeout(() => setCopiedShort(false), 2200);
    } catch (error) {
      console.error('Short URL copy failed:', error);
    } finally {
      setLoadingShort(false);
    }
  };

  const handleShortUrl = async () => {
    if (!shortUrl) setLoadingShort(true);
    await handleGenerateAndCopyShortUrl();
  };

  const handleRefreshRecipientsFromCloud = async () => {
    const { emails } = await loadPollRecipientsSynced(poll.id);
    setRecipientInput(formatPollRecipients(emails));
  };

  const handleSaveRecipients = async () => {
    const { emails } = await savePollRecipientsSynced(
      poll.id,
      recipientInput,
    );
    setRecipientInput(formatPollRecipients(emails));
    setRecipientsSaved(true);
    window.setTimeout(() => setRecipientsSaved(false), 1800);
  };

  const whatsappText = encodeURIComponent(
    currentLang === 'de'
      ? `Hallo! Bitte gib deine Verfügbarkeit für „${poll.title}“ an:\n${shareUrl}`
      : `Ciao! Indica la tua disponibilità per “${poll.title}”:\n${shareUrl}`,
  );

  const emailSubject = encodeURIComponent(
    currentLang === 'de'
      ? `Terminabstimmung: ${poll.title}`
      : `Sondaggio riunione: ${poll.title}`,
  );

  const emailBody = encodeURIComponent(
    currentLang === 'de'
      ? `Hallo,\n\nbitte gib deine Verfügbarkeit für „${poll.title}“ an.\n\n${shareUrl}\n\nVielen Dank,\n${poll.organizerName}`
      : `Ciao,\n\nindica le tue disponibilità per “${poll.title}”.\n\n${shareUrl}\n\nGrazie,\n${poll.organizerName}`,
  );

  const qrCodeUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0D4D5E&bgcolor=FFFFFF&data=${encodeURIComponent(shareUrl)}`;

  return (
    <div
      className="dns-modal-overlay"
      role="presentation"
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        aria-describedby="share-modal-description"
        tabIndex={-1}
        className="dns-modal dns-polls-modal-medium flex max-h-[92dvh] flex-col overflow-hidden outline-none"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-dns-mid/10 bg-dns-primary px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-alt text-[9px] font-bold uppercase tracking-[.07em] text-dns-soft">
              <Share2 className="h-3.5 w-3.5" />
              {t('shareModalTitle', currentLang)}
            </div>
            <h2
              id="share-modal-title"
              className="mt-1 truncate text-[18px] font-semibold text-white"
            >
              {poll.title}
            </h2>
          </div>

          <button
            id="share-modal-close-btn"
            type="button"
            onClick={onClose}
            data-dns-press
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label={copy.close}
            title={copy.close}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-5 sm:p-6">
          <p
            id="share-modal-description"
            className="font-alt text-[10px] leading-relaxed text-dns-muted"
          >
            {t('shareModalDesc', currentLang)}
          </p>

          <div className="mt-5 space-y-5">
            <section>
              <label className="dns-kicker" htmlFor="share-url-input">
                {copy.direct}
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="share-url-input"
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="dns-input h-10 min-w-0 flex-1 font-mono text-[10px]"
                  onFocus={event => event.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  data-dns-press
                  className="dns-button min-h-10 shrink-0" data-variant="primary"
                >
                  {copied
                    ? <Check className="h-4 w-4" />
                    : <Copy className="h-4 w-4" />}
                  {copied ? t('btnCopied', currentLang) : t('btnCopyLink', currentLang)}
                </button>
              </div>
              <div className="mt-1 min-h-4" aria-live="polite">
                {copied && (
                  <span className="font-alt text-[9px] font-semibold text-emerald-800">
                    {t('linkCopiedNote', currentLang)}
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-dns-mid/10 bg-dns-bg p-4">
              <label className="flex items-center gap-1.5 dns-kicker" htmlFor="short-url-input">
                <Link className="h-3.5 w-3.5" />
                {copy.short}
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="short-url-input"
                  type="text"
                  readOnly
                  value={shortUrl || shareUrl}
                  className="dns-input h-10 min-w-0 flex-1 font-mono text-[10px]"
                  onFocus={event => event.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={() => void handleShortUrl()}
                  disabled={loadingShort}
                  data-dns-press
                  className="dns-button min-h-10 shrink-0 disabled:cursor-not-allowed disabled:opacity-50" data-variant="secondary"
                >
                  {loadingShort
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : copiedShort
                      ? <Check className="h-4 w-4" />
                      : <Copy className="h-4 w-4" />}
                  {loadingShort
                    ? t('generatingShortUrl', currentLang)
                    : copiedShort
                      ? t('btnCopied', currentLang)
                      : shortUrl
                        ? t('btnCopyLink', currentLang)
                        : t('btnGenerateTinyUrl', currentLang)}
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-dns-mid/10 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <label
                  className="flex items-center gap-1.5 dns-kicker"
                  htmlFor="poll-recipient-list"
                >
                  <Users className="h-3.5 w-3.5" />
                  {copy.recipients}
                </label>
                <span className="font-alt text-[9px] font-semibold text-dns-muted">
                  {recipients.length}
                </span>
              </div>

              <textarea
                id="poll-recipient-list"
                rows={4}
                value={recipientInput}
                onChange={event => {
                  setRecipientInput(event.target.value);
                  setRecipientsSaved(false);
                }}
                placeholder="name@example.com"
                className="dns-input mt-1.5 w-full resize-y font-mono text-[10px]"
              />

              <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div className="max-w-xl space-y-2">
                  <p className="font-alt text-[9px] leading-relaxed text-dns-muted">
                    {copy.recipientsHint}
                  </p>
                  <PrivateRecipientSyncControl
                    currentLang={currentLang}
                    onAuthorized={handleRefreshRecipientsFromCloud}
                    compact
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveRecipients()}
                  data-dns-press
                  className="dns-button min-h-9 shrink-0" data-variant="secondary"
                >
                  {recipientsSaved
                    ? <Check className="h-3.5 w-3.5" />
                    : <Save className="h-3.5 w-3.5" />}
                  {recipientsSaved ? copy.saved : copy.saveRecipients}
                </button>
              </div>
            </section>

            <section>
              <div className="dns-kicker">{copy.quickShare}</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="whatsapp-share-btn"
                  className="dns-button min-h-10" data-variant="secondary"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                  id="email-share-btn"
                  className="dns-button min-h-10" data-variant="secondary"
                >
                  <Mail className="h-4 w-4" />
                  {t('sendEmail', currentLang)}
                </a>
              </div>
            </section>

            <section className="border-t border-dns-mid/10 pt-4">
              <button
                type="button"
                onClick={() => setShowQr(value => !value)}
                id="toggle-qr-btn"
                data-dns-press
                className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border border-dns-mid/10 bg-dns-bg px-3 font-alt text-[10px] font-semibold text-dns-deep"
                aria-expanded={showQr}
                aria-controls="share-qr-panel"
              >
                <span className="inline-flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-dns-mid" />
                  {showQr ? t('hideQr', currentLang) : t('showQr', currentLang)}
                </span>
                <span aria-hidden="true">{showQr ? '−' : '+'}</span>
              </button>

              {showQr && (
                <div
                  id="share-qr-panel"
                  className="mt-3 flex flex-col items-center rounded-lg border border-dns-mid/10 bg-dns-bg p-4 text-center"
                >
                  <div className="dns-kicker">{copy.qr}</div>
                  <img
                    src={qrCodeUrl}
                    alt={copy.qrAlt}
                    className="mt-3 h-40 w-40 rounded-md border border-dns-mid/15 bg-white p-2"
                  />
                  <p className="mt-2 font-alt text-[9px] text-dns-muted">
                    {t('scanQrNote', currentLang)}
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-dns-mid/10 bg-dns-bg px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            data-dns-press
            className="dns-button min-h-9" data-variant="secondary"
          >
            {t('btnClose', currentLang)}
          </button>
        </footer>
      </section>
    </div>
  );
};
