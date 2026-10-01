import React, { useEffect } from 'react';
import { setDNSToolChromeActiveSection } from '@dolomitinordicski/dns-shared-data/ui/tool-chrome';
import { formatDNSCoreHeaderStatus } from '@dolomitinordicski/dns-shared-data/ui/header-status';
import { Share2 } from 'lucide-react';
import { Language, t } from '../utils/i18n';
import { AccessibilityMount } from './AccessibilityMount';
import type { DNSCoreHeaderStatus } from '../lib/dnsCoreHeader';

interface HeaderProps {
  currentView: 'create' | 'list' | 'view' | 'calendar';
  onNavigate: (view: 'create' | 'list' | 'calendar') => void;
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  onQuickShareApp?: () => void;
  coreStatus: DNSCoreHeaderStatus;
  isInviteeMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  currentLang,
  onLanguageChange,
  onQuickShareApp,
  coreStatus,
  isInviteeMode = false,
}) => {
  useEffect(() => {
    setDNSToolChromeActiveSection(currentView);
  }, [currentView, isInviteeMode]);

  const coreHeader = formatDNSCoreHeaderStatus(coreStatus, currentLang);
  const subtitle = isInviteeMode
    ? t('inviteeHeaderTag', currentLang)
    : t('tagline', currentLang);

  return (
    <>
      <header
        data-dns-tool-header
        id="dns-polls-header"
        className="bg-dns-primary text-white shadow-[0_1px_0_rgba(255,255,255,.08)]"
      >
        <div className="dns-tool-header-shell">
          <button
            type="button"
            onClick={() => !isInviteeMode && onNavigate('list')}
            disabled={isInviteeMode}
            className="dns-tool-header-brand border-0 bg-transparent p-0 text-left text-white disabled:cursor-default"
            data-dns-press={!isInviteeMode ? '' : undefined}
            aria-label={!isInviteeMode ? t('navMyPolls', currentLang) : undefined}
          >
            <img
              src="https://dolomitinordicski.github.io/dns-shared-data/brand/logo-web.png"
              alt="Dolomiti NordicSki"
              className="dns-tool-header-logo"
            />
            <div className="dns-tool-header-identity">
              <div className="dns-tool-header-title"><strong>DNS</strong> <span>POLLS</span></div>
              <div className="dns-tool-header-subtitle">{subtitle}</div>
            </div>
          </button>

          <div className="dns-tool-header-actions">
            <div className="dns-tool-header-controls">
              <AccessibilityMount language={currentLang} />
              <div className="dns-tool-header-language">
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

            <div className="dns-tool-header-status" data-state={coreHeader.state} aria-live="polite">
              <span className="dns-tool-header-status-dot" />
              {coreHeader.text}
            </div>
          </div>
        </div>
      </header>

      <nav
        data-dns-tool-nav
        className="dns-tab-nav"
        aria-label={currentLang === 'de' ? 'DNS Polls Navigation' : 'Navigazione DNS Polls'}
      >
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
