/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import type { DNSDesignSystem } from '@dolomitinordicski/dns-shared-data/design-system';
import { Poll } from './types';
import { decodePollFromHash } from './utils/storage';
import {
  type FirestoreAccessError,
  type FirestoreSyncStatus,
  subscribeToPoll,
  subscribeToPollsFromFirestore,
} from './utils/firebaseStorage';
import {
  auth,
  googleAuthProvider,
  isFirebaseConfigured,
} from './lib/firebase';
import { DNS_DESIGN_FALLBACK } from './design/fallback';
import {
  applyDNSDesignFallback,
  dnsRuntimeSignature,
  loadAndApplyDNSDesignSystem,
} from './lib/designSystem';
import { initDNSUIRuntime } from './lib/uiRuntime';
import { Language, t } from './utils/i18n';
import { Header } from './components/Header';
import { AdminLogin } from './components/AdminLogin';
import { MyPollsList } from './components/MyPollsList';
import { CreatePollForm } from './components/CreatePollForm';
import { PollView } from './components/PollView';
import { PollCalendarView } from './components/PollCalendarView';
import { ShareModal } from './components/ShareModal';
import { Calendar as CalendarIcon } from 'lucide-react';

const normalizeEmail = (value?: string | null) =>
  (value || '').trim().toLowerCase();

function getAllowedAdminEmails(): string[] {
  const configured = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((email: string) => normalizeEmail(email))
    .filter(Boolean);

  return configured.length > 0
    ? configured
    : ['management@dolomitinordicski.com'];
}

export default function App() {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'view' | 'calendar'>('list');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [hasInitialPolls, setHasInitialPolls] = useState(!isFirebaseConfigured);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [appShareModalOpen, setAppShareModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<FirestoreSyncStatus>(isFirebaseConfigured ? 'connecting' : 'offline');
  const [currentLang, setCurrentLang] = useState<Language>('de');
  const [designSystem, setDesignSystem] = useState<DNSDesignSystem>(DNS_DESIGN_FALLBACK);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreAccessError, setFirestoreAccessError] = useState<FirestoreAccessError | null>(null);

  const initialPublicTarget = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('poll') || params.get('p');
    const hashPoll = decodePollFromHash();
    return { pollId, hashPoll };
  }, []);

  const isInviteeLink = Boolean(initialPublicTarget.pollId || initialPublicTarget.hashPoll);
  const allowedAdminEmails = useMemo(() => getAllowedAdminEmails(), []);

  const isAuthorizedAdmin = (user: User | null) =>
    Boolean(
      user?.email &&
      allowedAdminEmails.includes(normalizeEmail(user.email)),
    );

  useEffect(() => {
    let disposed = false;
    let activeDesignSystem = applyDNSDesignFallback();
    setDesignSystem(activeDesignSystem);
    let disposeRuntime = initDNSUIRuntime(activeDesignSystem);

    void loadAndApplyDNSDesignSystem().then(({ designSystem: loadedDesignSystem }) => {
      if (disposed) return;

      if (dnsRuntimeSignature(loadedDesignSystem) !== dnsRuntimeSignature(activeDesignSystem)) {
        disposeRuntime?.();
        disposeRuntime = initDNSUIRuntime(loadedDesignSystem);
      }

      activeDesignSystem = loadedDesignSystem;
      setDesignSystem(loadedDesignSystem);
    });

    return () => {
      disposed = true;
      disposeRuntime?.();
    };
  }, []);

  // Authentication is progressive: Polls stays open when Firestore rules allow
  // the dashboard collection read, and asks for the DNS admin account only when
  // the backend returns permission-denied.
  useEffect(() => {
    if (!auth || isInviteeLink) {
      setAuthReady(true);
      return;
    }

    return onAuthStateChanged(auth, async user => {
      if (!user) {
        setAdminUser(null);
        setAuthReady(true);
        return;
      }

      if (!isAuthorizedAdmin(user)) {
        setAuthError(
          currentLang === 'de'
            ? 'Dieses Google-Konto ist nicht für DNS Polls Admin freigegeben.'
            : 'Questo account Google non è autorizzato per DNS Polls Admin.',
        );
        setAdminUser(null);
        await signOut(auth);
        setAuthReady(true);
        return;
      }

      setAuthError(null);
      setAdminUser(user);
      setAuthReady(true);
    });
  }, [allowedAdminEmails, currentLang, isInviteeLink]);

  // Public links load only the requested poll.
  useEffect(() => {
    if (!isInviteeLink) return;

    setCurrentView('view');

    if (initialPublicTarget.pollId) {
      return subscribeToPoll(initialPublicTarget.pollId, poll => {
        if (poll) {
          setActivePoll(poll);
          setSyncStatus('live');
        } else {
          setSyncStatus('offline');
        }
      });
    }

    if (initialPublicTarget.hashPoll) {
      setActivePoll(initialPublicTarget.hashPoll);
      setSyncStatus('offline');
    }
  }, [initialPublicTarget, isInviteeLink]);

  // The dashboard first attempts the canonical collection read. If the deployed
  // rules require admin authentication, the repository reports "restricted"
  // instead of silently pretending that browser cache is the authoritative list.
  useEffect(() => {
    if (isInviteeLink) return;

    setHasInitialPolls(false);
    return subscribeToPollsFromFirestore(
      updatedPolls => {
        setPolls(current => (
          JSON.stringify(current) === JSON.stringify(updatedPolls)
            ? current
            : updatedPolls
        ));
        setHasInitialPolls(true);
      },
      status => setSyncStatus(status),
      error => setFirestoreAccessError(error),
    );
  }, [adminUser?.uid, isInviteeLink]);

  useEffect(() => {
    if (isInviteeLink || !activePoll) return;
    const fresh = polls.find(p => p.id === activePoll.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(activePoll)) {
      setActivePoll(fresh);
    }
  }, [polls, activePoll, isInviteeLink]);

  const handleAdminSignIn = async () => {
    if (!auth) {
      setAuthError(
        currentLang === 'de'
          ? 'Firebase Authentication ist nicht verfügbar.'
          : 'Firebase Authentication non è disponibile.',
      );
      return;
    }

    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      if (!isAuthorizedAdmin(result.user)) {
        setAuthError(
          currentLang === 'de'
            ? 'Dieses Google-Konto ist nicht für DNS Polls Admin freigegeben.'
            : 'Questo account Google non è autorizzato per DNS Polls Admin.',
        );
        await signOut(auth);
      }
    } catch (error) {
      const err = error as { code?: string };
      setAuthError(
        err?.code === 'auth/popup-closed-by-user'
          ? (
              currentLang === 'de'
                ? 'Anmeldung abgebrochen.'
                : 'Accesso annullato.'
            )
          : (
              currentLang === 'de'
                ? 'Google-Anmeldung fehlgeschlagen.'
                : 'Accesso Google non riuscito.'
            ),
      );
    }
  };

  const handleAdminSignOut = async () => {
    if (auth) await signOut(auth);
    setAdminUser(null);
    setPolls([]);
    setActivePoll(null);
    setCurrentView('list');
    setSyncStatus(isFirebaseConfigured ? 'connecting' : 'offline');
  };

  const refreshPollsList = () => {
    // Firestore listeners are authoritative and refresh automatically.
  };

  const handleSelectPoll = (poll: Poll) => {
    setActivePoll(poll);
    setCurrentView('view');
  };

  const handlePollCreated = (newPoll: Poll) => {
    setActivePoll(newPoll);
    setCurrentView('view');
    refreshPollsList();
  };

  const handlePollUpdated = (updatedPoll: Poll) => {
    setActivePoll(updatedPoll);
    refreshPollsList();
  };

  const handleNavigate = (view: 'create' | 'list' | 'calendar') => {
    if (syncStatus === 'restricted' && !adminUser) return;
    setCurrentView(view);
  };

  const adminLocked =
    !isInviteeLink &&
    syncStatus === 'restricted' &&
    !adminUser;

  const accessMessage =
    authError ||
    (
      firestoreAccessError && adminLocked
        ? (
            currentLang === 'de'
              ? 'Firestore schützt die vollständige Umfrageliste. Bitte mit dem freigegebenen DNS-Konto anmelden.'
              : 'Firestore protegge l’elenco completo dei sondaggi. Accedi con l’account DNS autorizzato.'
          )
        : null
    );

  return (
    <div className="min-h-screen bg-dns-bg text-dns-primary flex flex-col font-body selection:bg-dns-soft selection:text-dns-primary" data-dns-foundation="1.12.1">
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        activePollTitle={activePoll?.title}
        onQuickShareApp={() => setAppShareModalOpen(true)}
        isFirestoreConnected={syncStatus === 'live'}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        designSystem={designSystem}
        isInviteeMode={isInviteeLink && currentView === 'view'}
        isAdminLocked={adminLocked}
        adminEmail={adminUser?.email}
        onSignOut={adminUser ? handleAdminSignOut : undefined}
      />

      <main className="flex-1 pb-14">
        {!isInviteeLink && adminLocked && authReady && (
          <div data-dns-reveal>
            <AdminLogin
              currentLang={currentLang}
              onSignIn={handleAdminSignIn}
              error={accessMessage}
            />
          </div>
        )}

        {!isInviteeLink && !adminLocked && currentView === 'list' && !hasInitialPolls && (
          <div data-dns-reveal className="dns-shell space-y-5 py-5">
            <div className="dns-card p-6">
              <div className="h-3 w-28 animate-pulse rounded bg-dns-light/60" />
              <div className="mt-3 h-8 w-72 max-w-full animate-pulse rounded bg-dns-mid/10" />
              <div className="mt-3 h-3 w-[460px] max-w-full animate-pulse rounded bg-dns-mid/10" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map(item => (
                <div key={item} className="dns-kpi h-[86px] animate-pulse" />
              ))}
            </div>
            <div className="dns-card min-h-[320px] animate-pulse" />
          </div>
        )}

        {!isInviteeLink && !adminLocked && currentView === 'list' && hasInitialPolls && (
          <div data-dns-reveal>
            <MyPollsList
              polls={polls}
              onSelectPoll={handleSelectPoll}
              onCreateNew={() => setCurrentView('create')}
              onRefreshList={refreshPollsList}
              onOpenCalendarView={() => setCurrentView('calendar')}
              currentLang={currentLang}
              syncStatus={syncStatus}
            />
          </div>
        )}

        {!isInviteeLink && !adminLocked && currentView === 'create' && (
          <div data-dns-reveal>
            <CreatePollForm
              onPollCreated={handlePollCreated}
              onCancel={() => setCurrentView('list')}
              currentLang={currentLang}
            />
          </div>
        )}

        {currentView === 'view' && activePoll && (
          <div data-dns-reveal>
            <PollView
              poll={activePoll}
              onPollUpdated={handlePollUpdated}
              onBackToList={() => setCurrentView('list')}
              currentLang={currentLang}
              isInviteeMode={isInviteeLink}
            />
          </div>
        )}

        {!isInviteeLink && !adminLocked && currentView === 'calendar' && (
          <div data-dns-reveal className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-body">
            <div className="flex items-center justify-between border-b border-slate-300 pb-4">
              <div>
                <h1 className="font-heading font-extrabold text-2xl text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-6 h-6 text-dns-primary" />
                  {currentLang === 'de' ? 'Team-Kalenderansicht' : 'Visualizzazione Calendario Team'}
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  {currentLang === 'de'
                    ? 'Erkunde alle aktiven Umfragen auf dem Monatskalender, um beliebte Termine auf einen Blick zu sehen.'
                    : 'Esplora tutti i sondaggi attivi sul calendario mensile per visualizzare a colpo d\'occhio le date più popolate.'}
                </p>
              </div>

              <button
                onClick={() => setCurrentView('list')}
                data-dns-press
                data-dns-hover
                className="px-4 py-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-800 rounded-sm text-xs font-bold transition-colors shadow-xs"
              >
                ← {t('btnAllPolls', currentLang)}
              </button>
            </div>

            <PollCalendarView
              polls={polls}
              selectedPollId={activePoll?.id}
              onSelectPoll={handleSelectPoll}
              currentLang={currentLang}
            />
          </div>
        )}
      </main>

      {!isInviteeLink && !adminLocked && activePoll && (
        <ShareModal
          poll={activePoll}
          isOpen={appShareModalOpen}
          onClose={() => setAppShareModalOpen(false)}
          currentLang={currentLang}
        />
      )}

      <footer className="mt-6 bg-dns-primary px-4 py-4 font-alt md:px-[1.8rem]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-1 text-[10px] uppercase tracking-[.04em] text-white/65 md:flex-row md:items-center">
          <span>Dolomiti NordicSki</span>
          <span>DNS Polls · © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
