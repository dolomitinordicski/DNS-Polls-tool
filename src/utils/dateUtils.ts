import { TimeSlot, Participant } from '../types';
import { Language } from './i18n';

export function formatDate(dateString: string, lang: Language | string = 'de'): {
  weekday: string;
  dayMonth: string;
  year: string;
  fullFormatted: string;
} {
  if (!dateString) return { weekday: '', dayMonth: '', year: '', fullFormatted: '' };
  
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return { weekday: '', dayMonth: dateString, year: '', fullFormatted: dateString };

  const date = new Date(year, month - 1, day);
  
  const daysDe = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const daysIt = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  const monthsDe = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const monthsIt = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

  const days = lang === 'it' ? daysIt : daysDe;
  const months = lang === 'it' ? monthsIt : monthsDe;

  const weekday = days[date.getDay()];
  const monthName = months[date.getMonth()];
  
  return {
    weekday,
    dayMonth: lang === 'it' ? `${day} ${monthName}` : `${day}. ${monthName}`,
    year: `${year}`,
    fullFormatted: lang === 'it' ? `${weekday} ${day} ${monthName} ${year}` : `${weekday}, ${day}. ${monthName} ${year}`
  };
}

export function formatDateItalian(dateString: string): {
  weekday: string;
  dayMonth: string;
  year: string;
  fullFormatted: string;
} {
  return formatDate(dateString, 'it');
}

export function getSlotVoteSummary(slotId: string, participants: Participant[]) {
  let yes = 0;
  let maybe = 0;
  let no = 0;

  participants.forEach(p => {
    const vote = p.votes[slotId];
    if (vote === 'yes') yes++;
    else if (vote === 'maybe') maybe++;
    else if (vote === 'no') no++;
  });

  return { yes, maybe, no, score: yes * 2 + maybe * 1 };
}

export function getTopVotedSlot(slots: TimeSlot[], participants: Participant[]): string | null {
  if (slots.length === 0 || participants.length === 0) return null;

  let bestSlotId: string | null = null;
  let maxScore = -1;

  slots.forEach(slot => {
    const summary = getSlotVoteSummary(slot.id, participants);
    if (summary.score > maxScore && (summary.yes > 0 || summary.maybe > 0)) {
      maxScore = summary.score;
      bestSlotId = slot.id;
    }
  });

  return bestSlotId;
}
