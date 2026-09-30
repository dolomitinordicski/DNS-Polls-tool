/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Poll } from './types';
import { decodePollFromHash } from './utils/storage';
import {
  FirestoreSyncStatus,
  subscribeToPoll,
  subscribeToPollsFromFirestore,
} from './utils/firebaseStorage';
import { isFirebaseConfigured } from './lib/firebase';
import { Language, t } from './utils/i18n';
import { Header } from './components/Header';
import { MyPollsList } from './components/MyPollsList';
import { CreatePollForm } from './components/CreatePollForm';
import { PollView } from './components/PollView';
import { PollCalendarView } from './components/PollCalendarView';
import { ShareModal } from './components/ShareModal';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'view' | 'calendar'>('list');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [hasInitialPolls, setHasInitialPolls] = useState(!isFirebaseConfigured);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [appShareModalOpen, setAppShareModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<FirestoreSyncStatus>(isFirebaseConfigured ? 'connecting' : 'offline');
  const [currentLang, setCurrentLang] = useState<Language>('de');

  const initialPublicTarget = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('poll') || params.get('p');
    const hashPoll = decodePollFromHash();
    return { pollId, hashPoll };
  }, []);

  const isInviteeLink = Boolean(initialPublicTarget.pollId || initialPublicTarget.hashPoll);

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

  // Temporary operational mode: the admin dashboard stays open without authentication.
  // Public invitee links remain isolated from the full poll collection.
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
      status => setSyncStatus(status)
    );
  }, [isInviteeLink]);

  useEffect(() => {
    if (isInviteeLink || !activePoll) return;
    const fresh = polls.find(p => p.id === activePoll.id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(activePoll)) {
      setActivePoll(fresh);
    }
  }, [polls, activePoll, isInviteeLink]);

  const refreshPollsList = () => {
    // Firestore listeners are authoritative and will refresh the list automatically.
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
    setCurrentView(view);
  };

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
        isAdminLocked={false}
      />

      <main className="flex-1 pb-14">
        {!isInviteeLink && currentView === 'list' && !hasInitialPolls && (
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

        {!isInviteeLink && currentView === 'list' && hasInitialPolls && (
          <MyPollsList
            polls={polls}
            onSelectPoll={handleSelectPoll}
            onCreateNew={() => setCurrentView('create')}
            onRefreshList={refreshPollsList}
            onOpenCalendarView={() => setCurrentView('calendar')}
            currentLang={currentLang}
          />
        )}

        {!isInviteeLink && currentView === 'create' && (
          <CreatePollForm
            onPollCreated={handlePollCreated}
            onCancel={() => setCurrentView('list')}
            currentLang={currentLang}
          />
        )}

        {currentView === 'view' && activePoll && (
          <PollView
            poll={activePoll}
            onPollUpdated={handlePollUpdated}
            onBackToList={() => setCurrentView('list')}
            currentLang={currentLang}
            isInviteeMode={isInviteeLink}
          />
        )}

        {!isInviteeLink && currentView === 'calendar' && (
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

      {!isInviteeLink && activePoll && (
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
