import { Poll } from '../types';

const AUTOCOMPLETE_KEY = 'dns_polls_autocomplete_v1';

export interface AutocompleteData {
  organizers: string[];
  organizerEmails: string[];
  locations: string[];
  participants: string[];
}

const DEFAULT_DATA: AutocompleteData = {
  organizers: [
    'Marco Rossi',
    'Giuseppe Trentini',
    'Matteo Zandegiacomo',
    'Elena Bianchi',
    'Stefano Unterrichter'
  ],
  organizerEmails: [
    'management@dolomitinordicski.com',
    'info@dolomitinordicski.com'
  ],
  locations: [
    'Sede Centrale Dolomiti NordicSki',
    'Google Meet / Online',
    'Rifugio Passo Ciaredoles',
    'Centro Fondo Biathlon'
  ],
  participants: [
    'Elena Bianchi',
    'Giuseppe Trentini',
    'Chiara De Martin',
    'Stefano Unterrichter',
    'Marco Rossi'
  ]
};

export function getAutocompleteData(polls?: Poll[]): AutocompleteData {
  let stored: AutocompleteData = { ...DEFAULT_DATA };
  
  try {
    const raw = localStorage.getItem(AUTOCOMPLETE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      stored = {
        organizers: Array.from(new Set([...(parsed.organizers || []), ...DEFAULT_DATA.organizers])),
        organizerEmails: Array.from(new Set([...(parsed.organizerEmails || []), ...DEFAULT_DATA.organizerEmails])),
        locations: Array.from(new Set([...(parsed.locations || []), ...DEFAULT_DATA.locations])),
        participants: Array.from(new Set([...(parsed.participants || []), ...DEFAULT_DATA.participants])),
      };
    }
  } catch (e) {
    console.error('Error reading autocomplete store:', e);
  }

  // Also collect dynamically from live polls if provided
  if (polls && Array.isArray(polls)) {
    polls.forEach(p => {
      if (p.organizerName && !stored.organizers.includes(p.organizerName)) {
        stored.organizers.push(p.organizerName);
      }
      if (p.organizerEmail && !stored.organizerEmails.includes(p.organizerEmail)) {
        stored.organizerEmails.push(p.organizerEmail);
      }
      if (p.location && !stored.locations.includes(p.location)) {
        stored.locations.push(p.location);
      }
      p.participants?.forEach(part => {
        if (part.name && !stored.participants.includes(part.name)) {
          stored.participants.push(part.name);
        }
      });
    });
  }

  return stored;
}

export function saveAutocompleteEntry(category: keyof AutocompleteData, value: string) {
  if (!value || !value.trim()) return;
  const cleanVal = value.trim();

  try {
    const current = getAutocompleteData();
    const list = current[category] || [];
    if (!list.includes(cleanVal)) {
      list.push(cleanVal);
      current[category] = list;
      localStorage.setItem(AUTOCOMPLETE_KEY, JSON.stringify(current));
    }
  } catch (e) {
    console.error('Error saving autocomplete entry:', e);
  }
}
