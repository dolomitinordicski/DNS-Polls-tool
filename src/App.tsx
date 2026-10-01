/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { DNSDesignSystem } from '@dolomitinordicski/dns-shared-data/design-system';
import { Poll } from './types';
import { decodePollFromHash } from './utils/storage';
import {
  type FirestoreSyncStatus,
  type LegacyPollMigrationResult,
  getLegacyPollCandidateIds,
  importLegacyPollsNow,
  subscribeToPoll,
  subscribeToPollsFromFirestore,
} from './utils/firebaseStorage';
import { isFirebaseConfigured } from './lib/firebase';
import { DNS_DESIGN_FALLBACK } from './design/fallback';
import { probeDNSCoreHeader, type DNSCoreHeaderStatus } from './lib/dnsCoreHeader';
import {
  applyDNSDesignFallback,
  dnsRuntimeSignature,
  loadAndApplyDNSDesignSystem,
} from './lib/designSystem';
import { initDNSUIRuntime } from './lib/uiRuntime';
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
  const [designSystem, setDesignSystem] = useState<DNSDesignSystem>(DNS_DESIGN_FALLBACK);
  const [coreStatus, setCoreStatus] = useState<DNSCoreHeaderStatus>({ state: 'loading' });
  const [legacyCandidateIds, setLegacyCandidateIds] = useState<string[]>(() =>
    getLegacyPollCandidateIds(),
  );
  const [isRecoveringLegacy, setIsRecoveringLegacy] = useState(false);
  const [legacyRecoveryResult, setLegacyRecoveryResult] =
    useState<LegacyPollMigrationResult | null>(null);

  const initialPublicTarget = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('poll') || params.get('p');
    const hashPoll = decodePollFromHash();
    return { pollId, hashPoll };
  }, []);

  const isInviteeLink = Boolean(initialPublicTarget.pollId || initialPublicTarget.hashPoll);

  const missingLegacyPollCount = useMemo(
    () =>
      legacyCandidateIds.filter(
        id => !polls.some(poll => poll.id === id),
      ).length,
    [legacyCandidateIds, polls],
  );

  const handleRecoverLegacyPolls = async () => {
    if (isRecoveringLegacy) return;

    setIsRecoveringLegacy(true);
    setLegacyRecoveryResult(null);

    try {
      const result = await importLegacyPollsNow();
      setLegacyRecoveryResult(result);
      setLegacyCandidateIds(getLegacyPollCandidateIds());
    } catch (error) {
      console.error('Legacy poll recovery failed:', error);
      setLegacyRecoveryResult({
        candidates: legacyCandidateIds.length,
        createdPolls: 0,
        existingPolls: 0,
        responsesUpserted: 0,
        privateContactsUpserted: 0,
      });
    } finally {
      setIsRecoveringLegacy(false);
    }
  };
  useEffect(() => {
    void probeDNSCoreHeader().then(setCoreStatus);
  }, []);

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
    setCurrentView(view);
  };

  return (
    <div
      className="min-h-screen bg-dns-bg text-dns-primary flex flex-col font-body selection:bg-dns-soft selection:text-dns-primary"
      data-dns-foundation={designSystem.version}
    >
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        onQuickShareApp={
          currentView === 'view' && activePoll
            ? () => setAppShareModalOpen(true)
            : undefined
        }
        coreStatus={coreStatus}
        currentLang={currentLang}
        onLanguageChange={setCurrentLang}
        designSystem={designSystem}
        isInviteeMode={isInviteeLink && currentView === 'view'}
      />

      <main className="flex-1 pb-14">
        {!isInviteeLink && syncStatus === 'restricted' && (
          <div className="dns-shell pt-4" data-dns-reveal>
            <div
              className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 font-alt text-[10px] text-amber-900"
              role="status"
              aria-live="polite"
            >
              {currentLang === 'de'
                ? 'DNS Polls läuft im offenen Betriebsmodus. Die aktuell veröffentlichten Firestore-Regeln blockieren jedoch noch den vollständigen Live-Zugriff; bis zur Rules-Synchronisierung wird der lokale Cache angezeigt.'
                : 'DNS Polls è in modalità operativa aperta. Le Firestore Rules pubblicate bloccano ancora l’accesso live completo; fino alla loro sincronizzazione viene mostrata la cache locale.'}
            </div>
          </div>
        )}
        {!isInviteeLink && currentView === 'list' && !hasInitialPolls && (
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

        {!isInviteeLink && currentView === 'list' && hasInitialPolls && (
          <div data-dns-reveal>
            <MyPollsList
              polls={polls}
              onSelectPoll={handleSelectPoll}
              onCreateNew={() => setCurrentView('create')}
              onRefreshList={refreshPollsList}
              onOpenCalendarView={() => setCurrentView('calendar')}
              currentLang={currentLang}
              syncStatus={syncStatus}
              legacyPollCount={missingLegacyPollCount}
              isRecoveringLegacy={isRecoveringLegacy}
              legacyRecoveryResult={legacyRecoveryResult}
              onRecoverLegacyPolls={() => void handleRecoverLegacyPolls()}
            />
          </div>
        )}

        {!isInviteeLink && currentView === 'create' && (
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

        {!isInviteeLink && currentView === 'calendar' && (
          <div data-dns-reveal className="dns-shell space-y-5 py-5 font-body">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentView('list')}
                data-dns-press
                data-dns-hover
                className="dns-btn-secondary min-h-9"
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

      <footer
        className="mt-6 px-4 py-4 font-alt md:px-[1.8rem]"
        style={{
          background: 'var(--dns-footer-bg)',
          color: 'var(--dns-footer-text)',
          fontSize: 'var(--dns-footer-size)',
        }}
      >
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-1 uppercase tracking-[.04em] md:flex-row md:items-center">
          <span>Dolomiti NordicSki</span>
          <span>DNS Polls · © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
