import React from 'react';
import { Calendar as CalendarIcon, PlusCircle, List, Share2, Globe } from 'lucide-react';
import { Language, t } from '../utils/i18n';
import dnsLogoNegativ from '../assets/dns-logo-negativ.png';
import dnsLogoFarbe from '../assets/dns-logo-farbe.png';

interface HeaderProps {
  currentView: 'create' | 'list' | 'view' | 'calendar';
  onNavigate: (view: 'create' | 'list' | 'calendar') => void;
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
  activePollTitle?: string;
  onQuickShareApp?: () => void;
  isFirestoreConnected?: boolean;
  isInviteeMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  currentLang,
  onLanguageChange,
  activePollTitle,
  onQuickShareApp,
  isFirestoreConnected = true,
  isInviteeMode = false
}) => {
  return (
    <header className="bg-[#0D4D5E] text-white border-b-2 border-[#336979] sticky top-0 z-40 shadow-lg font-body">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Logo & Portal Title */}
        <div 
          onClick={() => !isInviteeMode && onNavigate('list')}
          className={`flex items-center gap-3 ${!isInviteeMode ? 'cursor-pointer group hover:opacity-95' : ''} transition-opacity`}
        >
          {/* Official DNS Logo */}
          <div className="group-hover:scale-102 transition-transform flex items-center justify-center shrink-0">
            <img 
              src={dnsLogoNegativ} 
              alt="Dolomiti NordicSki Official Logo" 
              className="h-[42px] w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = dnsLogoFarbe;
              }}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-2xl sm:text-3xl tracking-tight font-heading text-white drop-shadow-xs">
                DNS <span className="text-slate-200 font-normal">Polls</span>
              </span>
              <span className="text-[10px] uppercase tracking-widest font-black text-[#0D4D5E] bg-white px-2 py-0.5 rounded-sm shadow-xs">
                {isInviteeMode ? t('inviteeBadge', currentLang) : t('subBrand', currentLang)}
              </span>
            </div>
            <p className="text-xs text-slate-100 font-medium flex items-center gap-2 mt-0.5">
              <span>{isInviteeMode ? t('inviteeHeaderTag', currentLang) : t('tagline', currentLang)}</span>
              {isFirestoreConnected && (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 bg-[#083845] px-2 py-0.5 rounded-sm border border-emerald-500/50 font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Navigation & Language Toggle Bar */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap sm:flex-nowrap">
          {/* DE / IT Language Switcher */}
          <div className="flex items-center bg-[#083845] p-1 rounded-sm border border-slate-300/40 mr-1 shadow-inner" title="Sprache / Lingua">
            <Globe className="w-4 h-4 text-slate-200 ml-1.5 mr-1" />
            <button
              onClick={() => onLanguageChange('de')}
              id="lang-de-btn"
              className={`px-3 py-1 rounded-sm text-xs font-black transition-all ${
                currentLang === 'de'
                  ? 'bg-white text-[#083845] shadow-sm'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              DE
            </button>
            <button
              onClick={() => onLanguageChange('it')}
              id="lang-it-btn"
              className={`px-3 py-1 rounded-sm text-xs font-black transition-all ${
                currentLang === 'it'
                  ? 'bg-white text-[#083845] shadow-sm'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              IT
            </button>
          </div>

          {!isInviteeMode && (
            <>
              <button
                onClick={() => onNavigate('list')}
                id="nav-my-polls-btn"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs sm:text-sm font-extrabold transition-all ${
                  currentView === 'list'
                    ? 'bg-white text-[#0D4D5E] border-2 border-white shadow-md'
                    : 'bg-[#083845] text-white hover:bg-white hover:text-[#0D4D5E] border border-slate-300/40 shadow-xs'
                }`}
              >
                <List className="w-4 h-4" />
                <span>{t('navMyPolls', currentLang)}</span>
              </button>

              <button
                onClick={() => onNavigate('calendar')}
                id="nav-calendar-view-btn"
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-sm text-xs sm:text-sm font-extrabold transition-all ${
                  currentView === 'calendar'
                    ? 'bg-white text-[#0D4D5E] border-2 border-white shadow-md'
                    : 'bg-[#083845] text-white hover:bg-white hover:text-[#0D4D5E] border border-slate-300/40 shadow-xs'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>{t('navCalendar', currentLang)}</span>
              </button>

              <button
                onClick={() => onNavigate('create')}
                id="nav-create-poll-btn"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs sm:text-sm font-black transition-all shadow-md ${
                  currentView === 'create'
                    ? 'bg-[#8EBDC4] text-[#083845] border-2 border-white'
                    : 'bg-[#336979] text-white hover:bg-[#8EBDC4] hover:text-[#083845] border border-slate-200/40'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('navNewPoll', currentLang)}</span>
              </button>

              {onQuickShareApp && (
                <button
                  onClick={onQuickShareApp}
                  id="nav-share-app-btn"
                  title={t('shareApp', currentLang)}
                  className="p-2 rounded-sm text-white bg-[#083845] hover:bg-white hover:text-[#0D4D5E] border border-slate-300/40 transition-colors shadow-xs"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {activePollTitle && currentView === 'view' && !isInviteeMode && (
        <div className="bg-[#083845] border-t border-slate-300/30 px-4 py-2 text-center text-xs text-slate-100 flex items-center justify-center gap-2 font-medium">
          <CalendarIcon className="w-4 h-4 text-amber-400" />
          <span className="truncate max-w-lg">
            {t('viewingPoll', currentLang)} <strong className="text-white font-extrabold underline decoration-amber-400 decoration-2 underline-offset-2">{activePollTitle}</strong>
          </span>
        </div>
      )}
    </header>
  );
};
