/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { Poll } from './types';
import { decodePollFromHash } from './utils/storage';
import {
  FirestoreSyncStatus,
  subscribeToPoll,
  subscribeToPollsFromFirestore,
} from './utils/firebaseStorage';
import { auth, googleAuthProvider, isFirebaseConfigured } from './lib/firebase';
import { Language, t } from './utils/i18n';
import { Header } from './components/Header';
import { AdminLogin } from './components/AdminLogin';
import { MyPollsList } from './components/MyPollsList';
import { CreatePollForm } from './components/CreatePollForm';
import { PollView } from './components/PollView';
import { PollCalendarView } from './components/PollCalendarView';
import { ShareModal } from './components/ShareModal';
import { Calendar as CalendarIcon } from 'lucide-react';

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

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
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!auth);
  const [authError, setAuthError] = useState<string | null>(null);

  const initialPublicTarget = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('poll') || params.get('p');
    const hashPoll = decodePollFromHash();
    return { pollId, hashPoll };
  }, []);

  const isInviteeLink = Boolean(initialPublicTarget.pollId || initialPublicTarget.hashPoll);
  const allowedAdminEmails = useMemo(() => getAllowedAdminEmails(), []);

  const isAuthorizedAdmin = (user: User | null) =>
    Boolean(user?.email && allowedAdminEmails.includes(normalizeEmail(user.email)));

  // Authentication is only relevant for the DNS administrative area.
  useEffect(() => {
    if (!auth) {
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
            : 'Questo account Google non è autorizzato per DNS Polls Admin.'
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
  }, [allowedAdminEmails, currentLang]);

  // Public links subscribe only to the requested poll. They never subscribe to the full poll collection.
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

  // The full collection is loaded only after a verified admin session exists.
  useEffect(() => {
    if (isInviteeLink || !adminUser) return;

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
      status => setSyncStatus(status)
    );
  }, [adminUser, isInviteeLink]);

  // Keep the selected admin poll synchronized with the authenticated collection listener.
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
          : 'Firebase Authentication non è disponibile.'
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
            : 'Questo account Google non è autorizzato per DNS Polls Admin.'
        );
        await signOut(auth);
      }
    } catch (error) {
      const err = error as { code?: string };
      setAuthError(
        err?.code === 'auth/popup-closed-by-user'
          ? (currentLang === 'de' ? 'Anmeldung abgebrochen.' : 'Accesso annullato.')
          : (currentLang === 'de' ? 'Google-Anmeldung fehlgeschlagen.' : 'Accesso Google non riuscito.')
      );
    }
  };

  const handleAdminSignOut = async () => {
    if (auth) await signOut(auth);
    setAdminUser(null);
    setPolls([]);
    setActivePoll(null);
    setCurrentView('list');
  };

  const refreshPollsList = () => {
    // Firestore listeners are authoritative and will refresh the list automatically.
  };

  const handleSelectPoll = (poll: Poll) => {
    if (!adminUser) return;
    setActivePoll(poll);
    setCurrentView('view');
  };

  const handlePollCreated = (newPoll: Poll) => {
    if (!adminUser) return;
    setActivePoll(newPoll);
    setCurrentView('view');
    refreshPollsList();
  };

  const handlePollUpdated = (updatedPoll: Poll) => {
    setActivePoll(updatedPoll);
    refreshPollsList();
  };

  const handleNavigate = (view: 'create' | 'list' | 'calendar') => {
    if (!adminUser) return;
    setCurrentView(view);
  };

  const adminLocked = !isInviteeLink && (!authReady || !adminUser);

  return (
    <div className="min-h-screen bg-dns-bg text-dns-primary flex flex-col font-body selection:bg-dns-soft selection:text-dns-primary">
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        activePollTitle={activePoll?.title}
        onQuickShareApp={() => setAppShareModalOpen(true)}
        isFirestoreConnected={syncStatus === 'live'}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        isInviteeMode={isInviteeLink && currentView === 'view'}
        isAdminLocked={adminLocked}
        adminEmail={adminUser?.email}
        onSignOut={handleAdminSignOut}
      />

      <main className="flex-1 pb-14">
        {!isInviteeLink && !authReady && (
          <div className="max-w-md mx-auto px-4 py-16">
            <div className="h-52 bg-white border border-slate-300 rounded-[10px] animate-pulse" />
          </div>
        )}

        {!isInviteeLink && authReady && !adminUser && (
          <AdminLogin
            currentLang={currentLang}
            onSignIn={handleAdminSignIn}
            error={authError}
          />
        )}

        {!isInviteeLink && adminUser && currentView === 'list' && !hasInitialPolls && (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="min-h-[420px] bg-white border border-slate-300 rounded-sm p-6 shadow-xs">
              <div className="h-5 w-40 bg-slate-200 rounded-sm mb-5" />
              <div className="h-10 w-72 max-w-full bg-slate-100 rounded-sm mb-8" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="h-28 bg-slate-100 rounded-sm border border-slate-200" />
                <div className="h-28 bg-slate-100 rounded-sm border border-slate-200" />
                <div className="h-28 bg-slate-100 rounded-sm border border-slate-200" />
              </div>
            </div>
          </div>
        )}

        {!isInviteeLink && adminUser && currentView === 'list' && hasInitialPolls && (
          <MyPollsList
            polls={polls}
            onSelectPoll={handleSelectPoll}
            onCreateNew={() => setCurrentView('create')}
            onRefreshList={refreshPollsList}
            onOpenCalendarView={() => setCurrentView('calendar')}
            currentLang={currentLang}
          />
        )}

        {!isInviteeLink && adminUser && currentView === 'create' && (
          <CreatePollForm
            onPollCreated={handlePollCreated}
            onCancel={() => setCurrentView('list')}
            currentLang={currentLang}
          />
        )}

        {currentView === 'view' && activePoll && (isInviteeLink || adminUser) && (
          <PollView
            poll={activePoll}
            onPollUpdated={handlePollUpdated}
            onBackToList={() => setCurrentView('list')}
            currentLang={currentLang}
            isInviteeMode={isInviteeLink}
          />
        )}

        {!isInviteeLink && adminUser && currentView === 'calendar' && (
          <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 font-body">
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

      {!isInviteeLink && adminUser && activePoll && (
        <ShareModal
          poll={activePoll}
          isOpen={appShareModalOpen}
          onClose={() => setAppShareModalOpen(false)}
          currentLang={currentLang}
        />
      )}

      <footer className="bg-dns-primary px-4 md:px-[1.8rem] py-3 font-alt">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] md:text-[11px] uppercase tracking-[.04em] text-white/65">
          <span>Dolomiti NordicSki</span>
          <span>DNS Polls · © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
