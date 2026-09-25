/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Poll } from './types';
import { getLocalPolls, decodePollFromHash, savePoll } from './utils/storage';
import { subscribeToPollsFromFirestore, getPollFromFirestore } from './utils/firebaseStorage';
import { Language, t } from './utils/i18n';
import { Header } from './components/Header';
import { MyPollsList } from './components/MyPollsList';
import { CreatePollForm } from './components/CreatePollForm';
import { PollView } from './components/PollView';
import { PollCalendarView } from './components/PollCalendarView';
import { ShareModal } from './components/ShareModal';
import { Calendar as CalendarIcon, ShieldCheck } from 'lucide-react';
import dnsLogoNegativ from './assets/dns-logo-negativ.png';

export default function App() {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'view' | 'calendar'>('list');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [appShareModalOpen, setAppShareModalOpen] = useState(false);
  const [isFirestoreLive, setIsFirestoreLive] = useState(true);
  const [currentLang, setCurrentLang] = useState<Language>('de');
  const [isInviteeLink, setIsInviteeLink] = useState(false);

  // Real-time Firestore Subscription & Initial URL checking
  useEffect(() => {
    // Initial local fallback loading
    setPolls(getLocalPolls());

    // 1. Subscribe to real-time updates from Firestore
    const unsubscribe = subscribeToPollsFromFirestore((updatedPolls) => {
      setPolls(updatedPolls);
      setIsFirestoreLive(true);
    });

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

      if (!targetPoll && pollId) {
        targetPoll = getLocalPolls().find(p => p.id === pollId) || null;
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
    setPolls(getLocalPolls());
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
    <div className="min-h-screen bg-[#E5EFF3] text-slate-900 flex flex-col font-body selection:bg-slate-300 selection:text-slate-900">
      {/* Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        activePollTitle={activePoll?.title}
        onQuickShareApp={() => setAppShareModalOpen(true)}
        isFirestoreConnected={isFirestoreLive}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        isInviteeMode={isInviteeLink && currentView === 'view'}
      />

      {/* Main Content Area on Frosted Ice */}
      <main className="flex-1 pb-16">
        {currentView === 'list' && (
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
      <footer className="bg-dns-primary border-t border-dns-teal/50 py-6 px-4 text-center text-xs text-slate-200 space-y-3 font-body">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img 
              src={dnsLogoNegativ} 
              alt="Dolomiti NordicSki Logo" 
              className="h-[37px] w-auto object-contain" 
            />
            <span className="font-heading font-bold text-white text-sm">DNS Polls</span>
            <span className="text-[10px] bg-dns-teal/40 px-2 py-0.5 rounded-sm text-slate-200 font-mono">
              Dolomiti NordicSki
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {t('footerTransparency', currentLang)}
            </span>
          </div>

          <p className="text-[11px] text-slate-300">
            &copy; {new Date().getFullYear()} DNS Polls • Dolomiti NordicSki.
          </p>
        </div>
      </footer>
    </div>
  );
}
