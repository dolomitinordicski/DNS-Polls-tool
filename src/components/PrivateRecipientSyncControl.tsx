import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  LogIn,
  LogOut,
  Loader2,
} from 'lucide-react';
import {
  signInPrivateRecipientSync,
  signOutPrivateRecipientSync,
  subscribePrivateRecipientAuth,
  type PrivateRecipientAuthState,
} from '../data/privateRecipientSync';
import { Language } from '../utils/i18n';

interface PrivateRecipientSyncControlProps {
  currentLang: Language;
  onAuthorized?: () => void | Promise<void>;
  compact?: boolean;
}

export const PrivateRecipientSyncControl: React.FC<
  PrivateRecipientSyncControlProps
> = ({
  currentLang,
  onAuthorized,
  compact = false,
}) => {
  const [state, setState] =
    useState<PrivateRecipientAuthState>('signed-out');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  const copy = currentLang === 'de'
    ? {
        connect: 'Private Daten synchronisieren',
        connecting: 'Anmeldung…',
        connected: 'Privater Cloud-Sync aktiv',
        unavailable: 'Privater Cloud-Sync nicht verfügbar',
        disconnect: 'Abmelden',
        error: 'Anmeldung für private Daten fehlgeschlagen.',
      }
    : {
        connect: 'Sincronizza dati privati',
        connecting: 'Accesso…',
        connected: 'Sync cloud privato attivo',
        unavailable: 'Sync cloud privato non disponibile',
        disconnect: 'Disconnetti',
        error: 'Accesso ai dati privati non riuscito.',
      };

  useEffect(() => {
    let disposed = false;

    return subscribePrivateRecipientAuth((nextState) => {
      if (disposed) return;

      setState(nextState);

      if (nextState === 'authorized' && onAuthorized) {
        void Promise.resolve(onAuthorized()).catch(syncError => {
          console.error('Private recipient refresh failed:', syncError);
        });
      }
    });
  }, [onAuthorized]);

  const handleConnect = async () => {
    if (isWorking) return;

    setIsWorking(true);
    setError('');

    try {
      await signInPrivateRecipientSync();
    } catch (authError) {
      console.error('Private recipient authentication failed:', authError);
      setError(
        authError instanceof Error && authError.message
          ? authError.message
          : copy.error,
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisconnect = async () => {
    setIsWorking(true);
    setError('');

    try {
      await signOutPrivateRecipientSync();
    } catch (authError) {
      console.error('Private recipient sign-out failed:', authError);
      setError(copy.error);
    } finally {
      setIsWorking(false);
    }
  };

  if (state === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1.5 font-alt text-[9px] text-dns-muted">
        <Cloud className="h-3.5 w-3.5" />
        {copy.unavailable}
      </span>
    );
  }

  if (state === 'authorized') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-alt text-[9px] font-semibold text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {copy.connected}
        </span>

        <button
          type="button"
          onClick={() => void handleDisconnect()}
          disabled={isWorking}
          data-dns-press
          className="inline-flex min-h-7 items-center gap-1 border-0 bg-transparent p-0 font-alt text-[9px] font-semibold text-dns-muted hover:underline disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          {copy.disconnect}
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <button
        type="button"
        onClick={() => void handleConnect()}
        disabled={isWorking}
        data-dns-press
        className="dns-btn-secondary min-h-8"
      >
        {isWorking
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <LogIn className="h-3.5 w-3.5" />}
        {isWorking ? copy.connecting : copy.connect}
      </button>

      {error && (
        <div
          role="alert"
          className="max-w-xl font-alt text-[9px] leading-relaxed text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
};
