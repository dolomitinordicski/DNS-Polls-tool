import React, { useEffect, useRef } from 'react';
import type { DNSDesignSystem } from '@dolomitinordicski/dns-shared-data/design-system';
import {
  initDNSNavigationRuntime,
  type DNSNavigationRuntimeHandle,
} from '@dolomitinordicski/dns-shared-data/ui/navigation';
import { Share2 } from 'lucide-react';
import { Language, t } from '../utils/i18n';
import { AccessibilityMount } from './AccessibilityMount';
import type { DNSCoreHeaderStatus } from '../lib/dnsCoreHeader';

interface HeaderProps {
  currentView: 'create' | 'list' | 'view' | 'calendar';
  onNavigate: (view: 'create' | 'list' | 'calendar') => void;
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  designSystem: DNSDesignSystem;
  onQuickShareApp?: () => void;
  coreStatus: DNSCoreHeaderStatus;
  isInviteeMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  currentLang,
  onLanguageChange,
  designSystem,
  onQuickShareApp,
  coreStatus,
  isInviteeMode = false,
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
  }, [currentView, isInviteeMode]);

  const subtitle = isInviteeMode
    ? t('inviteeHeaderTag', currentLang)
    : t('tagline', currentLang);

  return (
    <>
      <header
        ref={headerRef}
        id="dns-polls-header"
        className="sticky top-0 z-30 bg-dns-primary text-white shadow-[0_1px_0_rgba(255,255,255,.08)]"
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-5 py-3.5 md:px-8">
          <button
            type="button"
            onClick={() => !isInviteeMode && onNavigate('list')}
            disabled={isInviteeMode}
            className="flex min-w-0 items-center gap-4 border-0 bg-transparent p-0 text-left text-white disabled:cursor-default"
            data-dns-press={!isInviteeMode ? '' : undefined}
            aria-label={!isInviteeMode ? t('navMyPolls', currentLang) : undefined}
          >
            <img
              src="https://dolomitinordicski.github.io/dns-shared-data/brand/logo-web.png"
              alt="Dolomiti NordicSki"
              className="h-10 w-auto shrink-0 object-contain"
            />
            <div className="min-w-0">
              <div className="whitespace-nowrap text-[22px] uppercase leading-none tracking-[.035em] text-white">
                <strong>DNS</strong> <span className="font-normal">POLLS</span>
              </div>
              <div className="mt-1.5 hidden truncate font-alt text-[11px] font-normal uppercase leading-tight tracking-[.06em] text-dns-soft md:block">
                {subtitle}
              </div>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-4">
            <div className="flex items-center gap-3">
              <AccessibilityMount language={currentLang} />
              <div className="flex gap-3 text-[10px] font-bold uppercase tracking-[.06em]">
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

            <div
              className={[
                'hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[.05em] xl:flex',
                coreStatus.state === 'ready' ? 'text-[#d8f0e7]' : '',
                coreStatus.state === 'error' ? 'text-[#ffd7d0]' : 'text-white/65',
              ].join(' ')}
              aria-live="polite"
            >
              <span
                className={[
                  'h-2 w-2 rounded-full',
                  coreStatus.state === 'ready' ? 'bg-emerald-400' : '',
                  coreStatus.state === 'error' ? 'bg-orange-400' : 'bg-dns-soft',
                ].join(' ')}
              />
              {coreStatus.state === 'ready'
                ? `${currentLang === 'de' ? 'DNS_Core verbunden' : 'DNS_Core connesso'} · ${coreStatus.reportingAreas}/${coreStatus.organizations}`
                : coreStatus.state === 'error'
                  ? (currentLang === 'de' ? 'DNS_Core nicht erreichbar' : 'DNS_Core non raggiungibile')
                  : (currentLang === 'de' ? 'DNS_Core verbindet…' : 'Connessione a DNS_Core…')}
            </div>
          </div>
        </div>
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

        {!isInviteeMode && (
          <div className="dns-tab-nav-inner">
            <button
              type="button"
              onClick={() => onNavigate('list')}
              data-section="list"
              data-dns-press
              className="dns-tab"
            >
              {t('navMyPolls', currentLang)}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              data-section="calendar"
              data-dns-press
              className="dns-tab"
            >
              {t('navCalendar', currentLang)}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('create')}
              data-section="create"
              data-dns-press
              className="dns-tab"
            >
              {t('navNewPoll', currentLang)}
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
                aria-label={t('shareApp', currentLang)}
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
