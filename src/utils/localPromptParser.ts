import { Language } from './i18n';

export interface ParsedPromptSlot {
  date: string;
  time: string;
}

export interface ParsedPollPrompt {
  title: string;
  description?: string;
  location?: string;
  slots: ParsedPromptSlot[];
}

const MONTHS: Record<string, number> = {
  januar: 1, gennaio: 1, january: 1,
  februar: 2, febbraio: 2, february: 2,
  marz: 3, maerz: 3, marzo: 3, march: 3,
  april: 4, aprile: 4,
  mai: 5, maggio: 5, may: 5,
  juni: 6, giugno: 6, june: 6,
  juli: 7, luglio: 7, july: 7,
  august: 8, agosto: 8,
  september: 9, settembre: 9,
  oktober: 10, ottobre: 10, october: 10,
  november: 11, novembre: 11,
  dezember: 12, dicembre: 12, december: 12,
};

const WEEKDAYS: Record<string, number> = {
  sonntag: 0, domenica: 0, sunday: 0,
  montag: 1, lunedi: 1, monday: 1,
  dienstag: 2, martedi: 2, tuesday: 2,
  mittwoch: 3, mercoledi: 3, wednesday: 3,
  donnerstag: 4, giovedi: 4, thursday: 4,
  freitag: 5, venerdi: 5, friday: 5,
  samstag: 6, sabato: 6, saturday: 6,
};

function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateString(day: number, month: number, explicitYear?: number): string {
  const today = new Date();
  let year = explicitYear || today.getFullYear();

  if (!explicitYear) {
    const candidate = new Date(year, month - 1, day);
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (candidate < todayOnly) year += 1;
  }

  return year + '-' + pad(month) + '-' + pad(day);
}

function formatTime(hour: string, minute?: string): string {
  return pad(Number(hour)) + ':' + (minute || '00');
}

function extractTimeRanges(segment: string, lang: Language): string[] {
  const rangeRegex = /(?:von\s+|dalle(?:\s+ore)?\s+|da\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:-|–|—|bis|alle|a)\s*(\d{1,2})(?::(\d{2}))?/gi;
  const ranges = Array.from(segment.matchAll(rangeRegex)).map(match =>
    formatTime(match[1], match[2]) + ' - ' + formatTime(match[3], match[4])
  );

  if (ranges.length > 0) return ranges;

  const single = segment.match(/(?:um|alle|ore)\s+(\d{1,2})(?::(\d{2}))?/i);
  if (single) return [formatTime(single[1], single[2])];

  if (/ganzt[aä]gig|tutto\s+il\s+giorno|all\s*day/i.test(segment)) {
    return [lang === 'de' ? 'Ganztägig' : 'Tutto il giorno'];
  }

  return [lang === 'de' ? 'Ganztägig' : 'Tutto il giorno'];
}

function cleanTitle(raw: string, lang: Language): string {
  let title = raw
    .replace(/^[\s\-–—:;,.]+|[\s\-–—:;,.]+$/g, '')
    .replace(/^erstelle\s+(?:bitte\s+)?(?:eine\s+)?umfrage\s+(?:für|zum|zur)\s+(?:das|den|die)?\s*/i, '')
    .replace(/^crea\s+(?:per\s+favore\s+)?(?:un\s+)?sondaggio\s+(?:per|su)\s+(?:il|la|lo)?\s*/i, '')
    .replace(/^create\s+(?:a\s+)?poll\s+(?:for|about)\s+/i, '')
    .trim();

  const sentenceBreak = title.search(/[.!?]/);
  if (sentenceBreak > 0) title = title.slice(0, sentenceBreak).trim();

  return title || (lang === 'de' ? 'Neue Umfrage' : 'Nuovo sondaggio');
}

function detectLocation(text: string): string | undefined {
  if (/\bonline\b/i.test(text)) return 'Online';
  if (/\bteams\b/i.test(text)) return 'Microsoft Teams';
  if (/\bzoom\b/i.test(text)) return 'Zoom';
  if (/\bgoogle\s+meet\b|\bmeet\b/i.test(text)) return 'Google Meet';

  const locationMatch = text.match(/(?:\bin\b|\ba\b)\s+([A-ZÄÖÜ][A-Za-zÀ-ÿÄÖÜäöüß' -]{2,40})(?=\s*(?:[,.]|$))/);
  return locationMatch?.[1]?.trim();
}

function extractDescription(text: string): string | undefined {
  const marker = text.match(/(?:beschreibung|tagesordnung|ziel\s+des\s+termins|agenda|descrizione|ordine\s+del\s+giorno|obiettivo(?:\s+dell['’]incontro)?)[\s:.-]*/i);
  if (!marker || marker.index === undefined) return undefined;

  const description = text.slice(marker.index + marker[0].length)
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, '')
    .trim();

  return description || undefined;
}

function parseGroupedDates(text: string, lang: Language): ParsedPromptSlot[] {
  const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  const groupRegex = new RegExp(
    '\\b((?:\\d{1,2}(?:\\.|º|°)?\\s*(?:,|und|e|and)\\s*)+\\d{1,2}(?:\\.|º|°)?)\\s*(' + monthNames + ')(?:\\s+(\\d{4}))?',
    'gi'
  );

  const groups = Array.from(text.matchAll(groupRegex));
  if (groups.length === 0) return [];

  const slots: ParsedPromptSlot[] = [];

  groups.forEach((match, index) => {
    const days = Array.from(match[1].matchAll(/\d{1,2}/g)).map(dayMatch => Number(dayMatch[0]));
    const month = MONTHS[normalizeWord(match[2])];
    const year = match[3] ? Number(match[3]) : undefined;
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < groups.length ? (groups[index + 1].index || text.length) : text.length;
    const segment = text.slice(start, end);
    const times = extractTimeRanges(segment, lang);

    days.forEach(day => {
      times.forEach(time => {
        slots.push({
          date: toDateString(day, month, year),
          time,
        });
      });
    });
  });

  return slots;
}

function parseExplicitDates(text: string, lang: Language): ParsedPromptSlot[] {
  const monthNames = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  const dateRegex = new RegExp(
    '\\b(\\d{1,2})(?:\\.|º|°)?\\s*(' + monthNames + ')(?:\\s+(\\d{4}))?',
    'gi'
  );

  const matches = Array.from(text.matchAll(dateRegex));
  const slots: ParsedPromptSlot[] = [];

  matches.forEach((match, index) => {
    const day = Number(match[1]);
    const month = MONTHS[normalizeWord(match[2])];
    const year = match[3] ? Number(match[3]) : undefined;
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index || text.length) : text.length;
    const segment = text.slice(start, end);
    const times = extractTimeRanges(segment, lang);

    times.forEach(time => {
      slots.push({
        date: toDateString(day, month, year),
        time,
      });
    });
  });

  return slots;
}

function parseRelativeWeekdays(text: string, lang: Language): ParsedPromptSlot[] {
  const weekdayNames = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
  const weekdayRegex = new RegExp(
    '\\b(?:(?:nächsten?|kommenden?|prossim[oa]|next)\\s+)?(' + weekdayNames + ')\\b',
    'gi'
  );

  const matches = Array.from(text.matchAll(weekdayRegex));
  if (matches.length === 0) return [];

  const today = new Date();
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const slots: ParsedPromptSlot[] = [];

  matches.forEach((match, index) => {
    const targetDow = WEEKDAYS[normalizeWord(match[1])];
    let diff = (targetDow - cursor.getDay() + 7) % 7;
    if (diff === 0) diff = 7;

    const date = new Date(cursor);
    date.setDate(cursor.getDate() + diff);
    cursor = date;

    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index || text.length) : text.length;
    const segment = text.slice(start, end);
    const times = extractTimeRanges(segment, lang);

    times.forEach(time => {
      slots.push({
        date: date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()),
        time,
      });
    });
  });

  return slots;
}

export function parsePollPrompt(text: string, lang: Language): ParsedPollPrompt {
  const input = text.trim();
  if (!input) throw new Error('EMPTY_PROMPT');

  let slots = parseGroupedDates(input, lang);
  if (slots.length === 0) slots = parseExplicitDates(input, lang);
  if (slots.length === 0) slots = parseRelativeWeekdays(input, lang);
  if (slots.length === 0) throw new Error('NO_DATES_FOUND');

  const firstDateIndex = input.search(/\b(?:\d{1,2}(?:\.|º|°)?\s*(?:,|und|e|and)\s*)*\d{1,2}(?:\.|º|°)?\s*[A-Za-zÀ-ÿÄÖÜäöüß]+|\b(?:nächsten?|kommenden?|prossim[oa]|next)\s+[A-Za-zÀ-ÿÄÖÜäöüß]+/i);
  const titleSource = firstDateIndex > 0 ? input.slice(0, firstDateIndex) : input;

  return {
    title: cleanTitle(titleSource, lang),
    description: extractDescription(input),
    location: detectLocation(input),
    slots,
  };
}
