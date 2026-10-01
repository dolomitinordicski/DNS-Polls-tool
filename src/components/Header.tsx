import React, { useEffect, useRef } from 'react';
import type { DNSDesignSystem } from '@dolomitinordicski/dns-shared-data/design-system';
import {
  initDNSNavigationRuntime,
  type DNSNavigationRuntimeHandle,
} from '@dolomitinordicski/dns-shared-data/ui/navigation';
import { Calendar as CalendarIcon, PlusCircle, List, LogOut, Share2 } from 'lucide-react';
import { Language, t } from '../utils/i18n';
import { AccessibilityMount } from './AccessibilityMount';

interface HeaderProps {
  currentView: 'create' | 'list' | 'view' | 'calendar';
  onNavigate: (view: 'create' | 'list' | 'calendar') => void;
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  designSystem: DNSDesignSystem;
  activePollTitle?: string;
  onQuickShareApp?: () => void;
  isFirestoreConnected?: boolean;
  isInviteeMode?: boolean;
  adminEmail?: string | null;
  onSignOut?: () => void;
  isAdminLocked?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  currentLang,
  onLanguageChange,
  designSystem,
  activePollTitle,
  onQuickShareApp,
  isInviteeMode = false,
  adminEmail,
  onSignOut,
  isAdminLocked = false
}) => {
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLSpanElement>(null);
  const navigationRuntimeRef = useRef<DNSNavigationRuntimeHandle | null>(null);

  useEffect(() => {
    if (!headerRef.current || !navRef.current) return;

    navigationRuntimeRef.current = initDNSNavigationRuntime({
      header: headerRef.current,
      nav: navRef.current,
      progressTrack: progressTrackRef.current,
      progressBar: progressBarRef.current,
      sectionTabs: Array.from(
        navRef.current.querySelectorAll<HTMLElement>('[data-section]')
      ),
      navigation: designSystem.navigation,
      responsive: designSystem.responsive,
    });

    navigationRuntimeRef.current.setActiveSection(currentView);

    return () => {
      navigationRuntimeRef.current?.disconnect();
      navigationRuntimeRef.current = null;
    };
  }, [designSystem]);

  useEffect(() => {
    navigationRuntimeRef.current?.setActiveSection(currentView);
    navigationRuntimeRef.current?.refresh();
  }, [currentView, activePollTitle, isInviteeMode, isAdminLocked]);

  const subtitle = isAdminLocked
    ? (currentLang === 'de' ? 'Geschützter Verwaltungsbereich' : 'Area amministrativa protetta')
    : isInviteeMode
      ? t('inviteeHeaderTag', currentLang)
      : t('tagline', currentLang);

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-0 z-30 bg-dns-primary text-white shadow-[var(--dns-header-shadow)]"
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-3.5 md:px-[1.8rem]">
          <button
            type="button"
            onClick={() => !isInviteeMode && onNavigate('list')}
            disabled={isInviteeMode}
            className="flex min-w-0 items-center gap-4 border-0 bg-transparent p-0 text-left text-white disabled:cursor-default"
            data-dns-press={!isInviteeMode ? '' : undefined}
            aria-label={!isInviteeMode ? t('navMyPolls', currentLang) : undefined}
          >
            <img
              src="./logo1.png"
              alt="Dolomiti NordicSki"
              className="h-8 w-auto shrink-0 object-contain md:h-10"
            />
            <div className="min-w-0">
              <div className="whitespace-nowrap text-[20px] uppercase leading-none tracking-[.035em] text-white md:text-[22px]">
                <span className="font-bold">DNS</span>
                <span className="ml-2 font-normal">POLLS</span>
              </div>
              <div className="mt-1.5 hidden truncate font-alt text-[11px] font-normal uppercase leading-tight tracking-[.06em] text-dns-soft md:block">
                {subtitle}
              </div>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-3">
            {!isInviteeMode && adminEmail && (
              <div className="hidden items-center gap-2 text-[10px] text-white/75 md:flex">
                <span className="max-w-[180px] truncate">{adminEmail}</span>
                {onSignOut && (
                  <button
                    type="button"
                    onClick={onSignOut}
                    data-dns-press
                    data-dns-hover
                    className="border-0 bg-transparent p-1 text-white/75 hover:text-white"
                    title={currentLang === 'de' ? 'Abmelden' : 'Esci'}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            <AccessibilityMount language={currentLang} />

            <div className="flex gap-2 text-[10px] font-bold uppercase tracking-[.06em]">
              {(['de', 'it'] as Language[]).map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onLanguageChange(lang)}
                  data-dns-press
                  className={[
                    'border-0 border-b-2 bg-transparent px-1 py-1 text-white',
                    currentLang === lang ? 'border-white' : 'border-transparent opacity-60'
                  ].join(' ')}
                  aria-pressed={currentLang === lang}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activePollTitle && currentView === 'view' && !isInviteeMode && (
          <div className="border-t border-white/10 bg-white/[.06] px-4 py-1.5 text-center font-alt text-[10px] text-white/75">
            {t('viewingPoll', currentLang)}{' '}
            <strong className="text-white">{activePollTitle}</strong>
          </div>
        )}
      </header>

      <nav
        ref={navRef}
        className="dns-tab-nav"
        aria-label={currentLang === 'de' ? 'DNS Polls Navigation' : 'Navigazione DNS Polls'}
      >
        <div
          ref={progressTrackRef}
          className="dns-scroll-progress-track"
          role="progressbar"
          aria-label={currentLang === 'de' ? 'Seitenfortschritt' : 'Avanzamento pagina'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
        >
          <span ref={progressBarRef} className="dns-scroll-progress-bar" />
        </div>

        {!isInviteeMode && !isAdminLocked && (
          <div className="dns-tab-nav-inner">
            <button
              type="button"
              onClick={() => onNavigate('list')}
              data-section="list"
              data-dns-press
              className="dns-tab"
            >
              <span className="inline-flex items-center gap-1.5">
                <List className="h-3.5 w-3.5" />
                {t('navMyPolls', currentLang)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              data-section="calendar"
              data-dns-press
              className="dns-tab"
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {t('navCalendar', currentLang)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('create')}
              data-section="create"
              data-dns-press
              className="dns-tab"
            >
              <span className="inline-flex items-center gap-1.5">
                <PlusCircle className="h-3.5 w-3.5" />
                {t('navNewPoll', currentLang)}
              </span>
            </button>

            <div className="flex-1" />

            {onQuickShareApp && (
              <button
                type="button"
                onClick={onQuickShareApp}
                data-dns-press
                data-dns-hover
                className="p-2 text-white/70 hover:text-white"
                title={t('shareApp', currentLang)}
              >
                <Share2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </nav>
    </>
  );
};
