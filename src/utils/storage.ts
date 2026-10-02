import { Poll } from '../types';

const STORAGE_KEY = 'dolomiti_polls_v1';

// Initial sample polls cleared per user request
export const SAMPLE_POLLS: Poll[] = [];

export function getLocalPolls(): Poll[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out legacy demo polls if present in localStorage
    const filtered = parsed.filter(p => p && p.id !== 'demo-1' && p.id !== 'demo-2');
    if (filtered.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch (e) {
    console.error('Error reading localStorage polls:', e);
    return [];
  }
}

export function getPollById(id: string): Poll | null {
  const polls = getLocalPolls();
  const found = polls.find(p => p.id === id);
  if (found) return found;

  // Try decoding from URL hash if present
  const hashPoll = decodePollFromHash();
  if (hashPoll && hashPoll.id === id) {
    savePoll(hashPoll);
    return hashPoll;
  }

  return null;
}

export function savePoll(poll: Poll): void {
  const polls = getLocalPolls();
  const index = polls.findIndex(p => p.id === poll.id);
  if (index >= 0) {
    polls[index] = poll;
  } else {
    polls.unshift(poll);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(polls));
  } catch (e) {
    console.error('Error saving poll to localStorage:', e);
  }
}

export function deletePoll(id: string): void {
  const polls = getLocalPolls().filter(p => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(polls));
  } catch (e) {
    console.error('Error deleting poll from localStorage:', e);
  }
}

export function replaceLocalPolls(polls: Poll[]): void {
  try {
    const clean = polls.filter(p => p && p.id !== 'demo-1' && p.id !== 'demo-2');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error('Error replacing localStorage poll cache:', e);
  }
}

/**
 * Encodes poll data to UTF-8 base64 string for URL hash sharing
 */
export function encodePollToHash(poll: Poll): string {
  try {
    const jsonStr = JSON.stringify(poll);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    utf8Bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary);
  } catch (e) {
    console.error('Error encoding poll to hash:', e);
    return '';
  }
}

/**
 * Decodes poll data from URL hash or query param if available
 */
export function decodePollFromHash(): Poll | null {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(window.location.search);
    const pollParam = params.get('p') || params.get('pollData') || params.get('d');

    let rawData = '';
    if (hash && hash.includes('data=')) {
      rawData = hash.split('data=')[1];
    } else if (pollParam) {
      rawData = pollParam;
    }

    if (!rawData) return null;

    const binary = atob(rawData);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const poll = JSON.parse(decoded) as Poll;
    if (poll && poll.id && poll.title && Array.isArray(poll.slots)) {
      return poll;
    }
  } catch (e) {
    try {
      const hash = window.location.hash.replace(/^#/, '');
      const rawData = hash.replace('data=', '');
      if (rawData) {
        const decoded = decodeURIComponent(atob(rawData));
        const poll = JSON.parse(decoded) as Poll;
        if (poll && poll.id && poll.title) return poll;
      }
    } catch (innerErr) {
      // ignore
    }
  }
  return null;
}

/**
 * Generates clean short shareable URL for a poll
 */
export function getPollShareUrl(poll: Poll): string {
  // Preserve the GitHub Pages project path (e.g. /DNS-Polls-tool/) and use
  // a query parameter that the static SPA can resolve without a server route.
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('poll', poll.id);
  return url.toString();
}

/**
 * Optionally generates ultra-short URL via TinyURL API with fallback
 */
export async function generateTinyUrl(urlToShorten: string): Promise<string> {
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(urlToShorten)}`);
    if (res.ok) {
      const shortUrl = await res.text();
      if (shortUrl && shortUrl.trim().startsWith('http')) {
        return shortUrl.trim();
      }
    }
  } catch (err) {
    console.warn('TinyURL service fallback:', err);
  }
  return urlToShorten;
}

