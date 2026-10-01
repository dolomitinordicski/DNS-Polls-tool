import React, { useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Language } from '../utils/i18n';

interface AdminLoginProps {
  currentLang: Language;
  onSignIn: () => Promise<void>;
  error?: string | null;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ currentLang, onSignIn, error }) => {
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    setBusy(true);
    try {
      await onSignIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-slate-300 rounded-[10px] p-7 shadow-[0_2px_10px_rgba(8,56,69,.06)] space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-dns-primary/[.07] text-dns-primary flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-xl text-dns-primary">DNS POLLS ADMIN</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              {currentLang === 'de' ? 'Geschützter Verwaltungsbereich' : 'Area amministrativa protetta'}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          {currentLang === 'de'
            ? 'Melden Sie sich mit einem freigegebenen DNS-Google-Konto an. Öffentliche Umfrage-Links benötigen keine Anmeldung.'
            : 'Accedi con un account Google DNS autorizzato. I link pubblici dei sondaggi non richiedono autenticazione.'}
        </p>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-dns-primary text-white hover:bg-dns-deep disabled:opacity-60 rounded-md text-xs font-bold transition-colors"
        >
          <LogIn className="w-4 h-4" />
          {busy
            ? (currentLang === 'de' ? 'Anmeldung…' : 'Accesso…')
            : (currentLang === 'de' ? 'Mit Google anmelden' : 'Accedi con Google')}
        </button>

        <p className="text-[10px] text-slate-500 leading-relaxed">
          {currentLang === 'de'
            ? 'Die Anmeldung schützt die Verwaltungsfunktionen. Die Firestore-Regeln erzwingen die Berechtigungen zusätzlich serverseitig.'
            : 'Il login protegge le funzioni amministrative. Le regole Firestore applicano inoltre i permessi lato server.'}
        </p>
      </div>
    </div>
  );
};
