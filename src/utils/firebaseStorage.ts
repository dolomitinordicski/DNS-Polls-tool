import { Poll } from '../types';
import { getPollShareUrl as getStorageShareUrl } from './storage';

export type {
  FirestoreAccessError,
  FirestoreSyncStatus,
} from '../data/pollRepository';

export {
  deletePoll as deletePollFromFirestore,
  fetchPolls as fetchPollsFromApi,
  finalizePollSlot as finalizePollSlotFirestore,
  getPoll as getPollFromFirestore,
  getPrivateContacts as getPrivateContactsForPoll,
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
