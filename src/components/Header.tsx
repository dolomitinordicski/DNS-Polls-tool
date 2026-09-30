import React from 'react';
import { Calendar as CalendarIcon, PlusCircle, List, Share2 } from 'lucide-react';
import { Language, t } from '../utils/i18n';

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
    <header className="sticky top-0 z-40 text-white font-heading shadow-[0_1px_0_rgba(255,255,255,.08)]">
      <div className="bg-dns-primary px-4 md:px-[1.8rem] py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div
            onClick={() => !isInviteeMode && onNavigate('list')}
            className={`flex items-center gap-[18px] min-w-0 ${!isInviteeMode ? 'cursor-pointer' : ''}`}
          >
            <img src="./dns-logo-negativ.png" alt="Dolomiti NordicSki" className="h-10 w-auto shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="text-[16px] font-bold leading-tight text-white">DNS Polls</div>
              <div className="font-alt text-[12px] font-light leading-tight text-dns-soft mt-0.5 truncate">
                {isInviteeMode ? t('inviteeHeaderTag', currentLang) : t('tagline', currentLang)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full bg-dns-teal px-3 py-1 text-[10px] font-semibold tracking-[.06em] ${isFirestoreConnected ? 'text-white' : 'text-white/65'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isFirestoreConnected ? 'bg-emerald-300' : 'bg-white/40'}`} />
              {isFirestoreConnected ? 'LIVE' : 'SYNC'}
            </span>
            <div className="flex items-center gap-1">
              {(['de','it'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => onLanguageChange(lang)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[.05em] ${currentLang===lang?'bg-white text-dns-primary':'bg-white/10 text-white/75 hover:bg-white/15'}`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!isInviteeMode && (
        <div className="bg-dns-teal px-4 md:px-[1.8rem]">
          <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto">
            <button onClick={() => onNavigate('list')} className={`px-3 py-2.5 text-[10px] uppercase tracking-[.06em] font-semibold border-b-[3px] whitespace-nowrap ${currentView==='list'?'text-white border-white':'text-white/60 border-transparent hover:text-white'}`}>
              <span className="inline-flex items-center gap-1.5"><List className="w-3.5 h-3.5"/>{t('navMyPolls', currentLang)}</span>
            </button>
            <button onClick={() => onNavigate('calendar')} className={`px-3 py-2.5 text-[10px] uppercase tracking-[.06em] font-semibold border-b-[3px] whitespace-nowrap ${currentView==='calendar'?'text-white border-white':'text-white/60 border-transparent hover:text-white'}`}>
              <span className="inline-flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5"/>{t('navCalendar', currentLang)}</span>
            </button>
            <button onClick={() => onNavigate('create')} className={`px-3 py-2.5 text-[10px] uppercase tracking-[.06em] font-semibold border-b-[3px] whitespace-nowrap ${currentView==='create'?'text-white border-white':'text-white/60 border-transparent hover:text-white'}`}>
              <span className="inline-flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5"/>{t('navNewPoll', currentLang)}</span>
            </button>
            <div className="flex-1"/>
            {onQuickShareApp && (
              <button onClick={onQuickShareApp} className="p-2 text-white/70 hover:text-white" title={t('shareApp', currentLang)}>
                <Share2 className="w-4 h-4"/>
              </button>
            )}
          </div>
        </div>
      )}

      {activePollTitle && currentView === 'view' && !isInviteeMode && (
        <div className="bg-white/95 border-b border-[rgba(65,116,131,.16)] px-4 py-1.5 text-center text-[10px] text-dns-teal">
          {t('viewingPoll', currentLang)} <strong className="text-dns-primary">{activePollTitle}</strong>
        </div>
      )}
    </header>
  );};
