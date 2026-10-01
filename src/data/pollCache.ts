import { Poll } from '../types';
import {
  deletePoll as deleteLocalPoll,
  getLocalPolls,
  replaceLocalPolls,
  savePoll as saveLocalPoll,
} from '../utils/storage';
import { publicPollForCache, sortPolls } from './pollDocuments';

export function readLegacyPollCache(): Poll[] {
  return getLocalPolls();
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
