import { Poll } from '../types';
import { deletePoll } from '../data/pollRepository';
import { clearPollRecipients } from './pollRecipientStore';
import { getPollShareUrl as getStorageShareUrl } from './storage';

export type {
  FirestoreAccessError,
  FirestoreSyncStatus,
  LegacyPollMigrationResult,
} from '../data/pollRepository';

export {
  fetchPolls as fetchPollsFromApi,
  finalizePollSlot as finalizePollSlotFirestore,
  getPoll as getPollFromFirestore,
  getPrivateContacts as getPrivateContactsForPoll,
  importLegacyPollsNow,
  savePoll as savePollToFirestore,
  submitParticipantVote,
  subscribeToPoll,
  subscribeToPolls,
  subscribeToPolls as subscribeToPollsFromFirestore,
} from '../data/pollRepository';

/**
 * Stable compatibility facade used by existing Polls views.
 *
 * P.2 moved persistence into src/data/pollRepository.ts so components no longer
 * own knowledge of Firestore paths, migrations, cache fallback or privacy
 * boundaries. This file stays intentionally thin while the views are refactored
 * in later phases.
 */
export function getPollShareUrl(poll: Poll): string {
  return getStorageShareUrl(poll);
}

export async function deletePollFromFirestore(pollId: string): Promise<void> {
  await deletePoll(pollId);
  clearPollRecipients(pollId);
}

export { getLegacyPollCandidateIds } from '../data/pollCache';
