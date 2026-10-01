import { Poll } from '../types';
import {
  deletePoll as deleteLocalPoll,
  getLocalPolls,
  replaceLocalPolls,
  savePoll as saveLocalPoll,
} from '../utils/storage';
import { publicPollForCache, sortPolls } from './pollDocuments';

const LEGACY_BACKUP_KEY = 'dns_polls_legacy_backup_v1';

function readLegacyBackup(): Poll[] {
  try {
    const raw = localStorage.getItem(LEGACY_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Could not read DNS Polls legacy backup:', error);
    return [];
  }
}

function writeLegacyBackup(polls: Poll[]): void {
  try {
    localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(polls));
  } catch (error) {
    console.error('Could not write DNS Polls legacy backup:', error);
  }
}

function mergeLegacySnapshots(existing: Poll[], current: Poll[]): Poll[] {
  const byId = new Map<string, Poll>();

  // Existing backup wins for the same ID because it can contain richer legacy
  // participant/e-mail fields that the current public cache intentionally strips.
  existing.forEach(poll => {
    if (poll?.id) byId.set(poll.id, poll);
  });

  current.forEach(poll => {
    if (poll?.id && !byId.has(poll.id)) byId.set(poll.id, poll);
  });

  return [...byId.values()];
}

export function captureLegacyPollSnapshot(): Poll[] {
  const current = getLocalPolls();
  const merged = mergeLegacySnapshots(readLegacyBackup(), current);

  if (merged.length > 0) {
    writeLegacyBackup(merged);
  }

  return merged;
}

export function readLegacyPollCache(): Poll[] {
  return captureLegacyPollSnapshot();
}

export function getLegacyPollCandidateCount(): number {
  return captureLegacyPollSnapshot().length;
}

export function getLegacyPollCandidateIds(): string[] {
  return captureLegacyPollSnapshot()
    .map(poll => poll.id)
    .filter(Boolean);
}

export function readPollCache(): Poll[] {
  return sortPolls(getLocalPolls().map(publicPollForCache));
}

export function replacePollCache(polls: Poll[]): Poll[] {
  const clean = sortPolls(polls.map(publicPollForCache));
  replaceLocalPolls(clean);
  return clean;
}

export function cachePoll(poll: Poll): Poll {
  const clean = publicPollForCache(poll);
  saveLocalPoll(clean);
  return clean;
}

export function removeCachedPoll(pollId: string): void {
  deleteLocalPoll(pollId);
}
