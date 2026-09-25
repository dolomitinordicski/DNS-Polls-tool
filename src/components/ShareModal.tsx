import React, { useState } from 'react';
import { Poll } from '../types';
import { getPollShareUrl } from '../utils/firebaseStorage';
import { generateTinyUrl } from '../utils/storage';
import { Language, t } from '../utils/i18n';
import { Copy, Check, Share2, MessageCircle, Mail, QrCode, X, Link, Loader2 } from 'lucide-react';

interface ShareModalProps {
  poll: Poll;
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

export const ShareModal: React.FC<ShareModalProps> = ({ poll, isOpen, onClose, currentLang = 'de' }) => {
  const [copied, setCopied] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [loadingShort, setLoadingShort] = useState(false);

  if (!isOpen) return null;

  const shareUrl = getPollShareUrl(poll);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  };

  const handleGenerateAndCopyShortUrl = async () => {
    if (shortUrl) {
      navigator.clipboard.writeText(shortUrl);
      setCopiedShort(true);
      setTimeout(() => setCopiedShort(false), 2500);
      return;
    }

    setLoadingShort(true);
    const generated = await generateTinyUrl(shareUrl);
    setShortUrl(generated);
    setLoadingShort(false);
    navigator.clipboard.writeText(generated);
    setCopiedShort(true);
    setTimeout(() => setCopiedShort(false), 2500);
  };

  const whatsappText = encodeURIComponent(
    currentLang === 'de'
      ? `👋 Hallo! Nimm an der Umfrage zur Terminabstimmung teil: "${poll.title}".\nGib hier deine Verfügbarkeiten an:\n${shareUrl}`
      : `👋 Ciao! Partecipa al sondaggio per decidere la data della riunione: "${poll.title}".\nCompila le tue preferenze qui:\n${shareUrl}`
  );

  const emailSubject = encodeURIComponent(
    currentLang === 'de' ? `Terminabstimmung: ${poll.title}` : `Sondaggio Riunione: ${poll.title}`
  );
  const emailBody = encodeURIComponent(
    currentLang === 'de'
      ? `Hallo,\n\nich lade dich ein, deine Verfügbarkeit für "${poll.title}" anzugeben.\n\nUnter folgendem Link kannst du deine Zeiten wählen:\n${shareUrl}\n\nVielen Dank,\n${poll.organizerName}`
      : `Ciao,\n\nTi invito a indicare le tue disponibilità per la riunione "${poll.title}".\n\nPuoi scegliere le tue preferenze a questo link:\n${shareUrl}\n\nGrazie,\n${poll.organizerName}`
  );

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&color=0D4D5E&bgcolor=FFFFFF&data=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in font-body">
      <div 
        className="bg-white border border-slate-300 rounded-sm w-full max-w-lg overflow-hidden shadow-xl text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-dns-primary px-5 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-slate-200" />
            <h3 className="font-heading font-extrabold text-base text-white">{t('shareModalTitle', currentLang)}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-200 hover:text-white p-1 rounded-sm hover:bg-dns-teal/40 transition-colors"
            id="share-modal-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5">
          <div>
            <h4 className="font-heading font-extrabold text-[#083845] text-base mb-0.5">
              {poll.title}
            </h4>
            <p className="text-xs text-slate-600">
              {t('shareModalDesc', currentLang)}
            </p>
          </div>

          {/* Share Link Input Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {t('directLink', currentLang)}
            </label>
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-sm p-1">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="bg-transparent text-xs text-slate-900 px-2 py-1 w-full focus:outline-none select-all font-mono"
              />
              <button
                onClick={handleCopy}
                id="copy-link-btn"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm font-bold text-xs transition-all whitespace-nowrap shadow-xs ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-dns-primary text-white hover:bg-dns-deep'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>{t('btnCopied', currentLang)}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t('btnCopyLink', currentLang)}</span>
                  </>
                )}
              </button>
            </div>
            {copied && (
              <p className="text-xs text-emerald-700 flex items-center gap-1 font-bold mt-1">
                <Check className="w-3.5 h-3.5" />
                {t('linkCopiedNote', currentLang)}
              </p>
            )}
          </div>

          {/* Short URL Section */}
          <div className="space-y-1.5 bg-sky-50/70 p-2.5 rounded-sm border border-sky-200">
            <label className="text-xs font-extrabold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-sky-700" />
              <span>{t('shortUrlLabel', currentLang)}</span>
            </label>
            <div className="flex items-center gap-2 bg-white border border-sky-300 rounded-sm p-1">
              <input
                type="text"
                readOnly
                placeholder={t('shortUrlLabel', currentLang)}
                value={shortUrl || shareUrl}
                className="bg-transparent text-xs text-slate-900 px-2 py-1 w-full focus:outline-none select-all font-mono"
              />
              <button
                onClick={handleGenerateAndCopyShortUrl}
                disabled={loadingShort}
                id="generate-short-url-btn"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm font-bold text-xs transition-all whitespace-nowrap shadow-xs ${
                  copiedShort
                    ? 'bg-emerald-600 text-white'
                    : 'bg-sky-700 text-white hover:bg-sky-800'
                }`}
              >
                {loadingShort ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('generatingShortUrl', currentLang)}</span>
                  </>
                ) : copiedShort ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>{t('btnCopied', currentLang)}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{shortUrl ? t('btnCopyLink', currentLang) : t('btnGenerateTinyUrl', currentLang)}</span>
                  </>
                )}
              </button>
            </div>
            {copiedShort && (
              <p className="text-xs text-emerald-700 flex items-center gap-1 font-bold mt-1">
                <Check className="w-3.5 h-3.5" />
                {t('linkCopiedNote', currentLang)}
              </p>
            )}
          </div>

          {/* Quick Share Options */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <a
              href={`https://api.whatsapp.com/send?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              id="whatsapp-share-btn"
              className="flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 py-2 px-3 rounded-sm text-xs font-bold transition-all"
            >
              <MessageCircle className="w-4 h-4 text-emerald-700" />
              <span>WhatsApp</span>
            </a>

            <a
              href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
              id="email-share-btn"
              className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 py-2 px-3 rounded-sm text-xs font-bold transition-all"
            >
              <Mail className="w-4 h-4 text-slate-600" />
              <span>{t('sendEmail', currentLang)}</span>
            </a>
          </div>

          {/* QR Code Toggle */}
          <div className="border-t border-slate-200 pt-3">
            <button
              onClick={() => setShowQr(!showQr)}
              id="toggle-qr-btn"
              className="flex items-center justify-between w-full text-xs font-bold text-slate-700 hover:text-dns-primary py-1 transition-colors"
            >
              <span className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-slate-600" />
                {showQr ? t('hideQr', currentLang) : t('showQr', currentLang)}
              </span>
              <span className="text-slate-500">{showQr ? '▲' : '▼'}</span>
            </button>

            {showQr && (
              <div className="mt-3 flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-800 rounded-sm border border-slate-200 text-center">
                <img
                  src={qrCodeUrl}
                  alt="QR Code Sondaggio"
                  className="w-40 h-40 rounded-sm border border-slate-300 p-2 bg-white mb-2"
                />
                <p className="text-xs font-normal text-slate-600">
                  {t('scanQrNote', currentLang)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-5 py-2.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold rounded-sm transition-colors"
          >
            {t('btnClose', currentLang)}
          </button>
        </div>
      </div>
    </div>
  );
};
