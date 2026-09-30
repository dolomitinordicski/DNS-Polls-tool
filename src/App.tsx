/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Poll } from './types';
import { decodePollFromHash, savePoll } from './utils/storage';
import { subscribeToPollsFromFirestore, getPollFromFirestore, FirestoreSyncStatus } from './utils/firebaseStorage';
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
  const [isInviteeLink, setIsInviteeLink] = useState(false);

  // Real-time Firestore Subscription & Initial URL checking
  useEffect(() => {
    const unsubscribe = subscribeToPollsFromFirestore(
      (updatedPolls) => {
        setPolls(current => (
          JSON.stringify(current) === JSON.stringify(updatedPolls)
            ? current
            : updatedPolls
        ));
        setHasInitialPolls(true);
      },
      (status) => setSyncStatus(status)
    );

    // 2. Check if URL param or hash contains poll data
    const checkUrlParams = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const pollId = urlParams.get('poll') || urlParams.get('p');
      const hashPoll = decodePollFromHash();

      let targetPoll: Poll | null = null;

      if (pollId || hashPoll) {
        setIsInviteeLink(true);
      }

      if (pollId) {
        targetPoll = await getPollFromFirestore(pollId);
      }

      if (hashPoll) {
        if (!targetPoll) {
          targetPoll = hashPoll;
        } else {
          // If hash version has newer edit timestamp or slots, prioritize hash slots and title
          const hashTime = hashPoll.updatedAt || hashPoll.createdAt || '';
          const targetTime = targetPoll.updatedAt || targetPoll.createdAt || '';
          const isHashNewer = hashTime >= targetTime;

          // Merge participants from both
          const partMap = new Map();
          (targetPoll.participants || []).forEach(p => partMap.set(p.id, p));
          (hashPoll.participants || []).forEach(p => {
            if (!partMap.has(p.id)) partMap.set(p.id, p);
          });

          targetPoll = {
            ...(isHashNewer ? hashPoll : targetPoll),
            participants: Array.from(partMap.values()),
            slots: isHashNewer ? hashPoll.slots : (targetPoll.slots || hashPoll.slots)
          };
        }
      }

      if (targetPoll) {
        savePoll(targetPoll);
        setActivePoll(targetPoll);
        setCurrentView('view');
      }
    };

    checkUrlParams();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Synchronize activePoll with real-time Firestore updates
  useEffect(() => {
    if (activePoll) {
      const fresh = polls.find(p => p.id === activePoll.id);
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(activePoll)) {
        setActivePoll(fresh);
      }
    }
  }, [polls]);

  const refreshPollsList = () => {
    // Firestore listeners are authoritative and will refresh the list automatically.
  };

  const handleSelectPoll = (poll: Poll) => {
    setIsInviteeLink(false);
    setActivePoll(poll);
    setCurrentView('view');
  };

  const handlePollCreated = (newPoll: Poll) => {
    setIsInviteeLink(false);
    setActivePoll(newPoll);
    setCurrentView('view');
    refreshPollsList();
  };

  const handlePollUpdated = (updatedPoll: Poll) => {
    setActivePoll(updatedPoll);
    refreshPollsList();
  };

  const handleNavigate = (view: 'create' | 'list' | 'calendar') => {
    setIsInviteeLink(false);
    setCurrentView(view);
  };

  return (
    <div className="min-h-screen bg-dns-bg text-dns-primary flex flex-col font-body selection:bg-dns-soft selection:text-dns-primary">
      {/* Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        activePollTitle={activePoll?.title}
        onQuickShareApp={() => setAppShareModalOpen(true)}
        isFirestoreConnected={syncStatus === 'live'}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        isInviteeMode={isInviteeLink && currentView === 'view'}
      />

      {/* Main Content Area on Frosted Ice */}
      <main className="flex-1 pb-14">
        {currentView === 'list' && !hasInitialPolls && (
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

        {currentView === 'list' && hasInitialPolls && (
          <MyPollsList
            polls={polls}
            onSelectPoll={handleSelectPoll}
            onCreateNew={() => setCurrentView('create')}
            onRefreshList={refreshPollsList}
            onOpenCalendarView={() => setCurrentView('calendar')}
            currentLang={currentLang}
          />
        )}

        {currentView === 'create' && (
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

        {currentView === 'calendar' && (
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

      {/* App Quick Share Modal if active */}
      {activePoll && (
        <ShareModal
          poll={activePoll}
          isOpen={appShareModalOpen}
          onClose={() => setAppShareModalOpen(false)}
          currentLang={currentLang}
        />
      )}

      {/* Footer */}
      <footer className="bg-dns-primary px-4 md:px-[1.8rem] py-3 font-alt">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] md:text-[11px] uppercase tracking-[.04em] text-white/65">
          <span>Dolomiti NordicSki</span>
          <span>DNS Polls · © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
