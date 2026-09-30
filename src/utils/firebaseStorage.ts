import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore';
import { ParticipantIdentity, Poll, VoteStatus } from '../types';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  deletePoll as deleteLocalPoll,
  getLocalPolls,
  getPollShareUrl as getStorageShareUrl,
  replaceLocalPolls,
  savePoll as saveLocalPoll,
} from './storage';

const POLLS_COLLECTION = 'polls';
const LEGACY_MIGRATION_KEY = 'dns_polls_firestore_migration_v1';

export type FirestoreSyncStatus = 'connecting' | 'live' | 'offline';

export function getPollShareUrl(poll: Poll): string {
  return getStorageShareUrl(poll);
}

function toFirestorePoll(poll: Poll): Poll {
  return JSON.parse(JSON.stringify(poll)) as Poll;
}

function sortPolls(polls: Poll[]): Poll[] {
  return [...polls].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

function cacheRemotePolls(polls: Poll[]): Poll[] {
  const sorted = sortPolls(polls);
  replaceLocalPolls(sorted);
  return sorted;
}

async function migrateLegacyCacheIfNeeded(remotePolls: Poll[]): Promise<boolean> {
  if (!db || remotePolls.length > 0) return false;
  if (localStorage.getItem(LEGACY_MIGRATION_KEY) === 'done') return false;

  const legacyPolls = getLocalPolls();
  if (legacyPolls.length === 0) {
    localStorage.setItem(LEGACY_MIGRATION_KEY, 'done');
    return false;
  }

  await Promise.all(
    legacyPolls.map(poll =>
      setDoc(doc(db, POLLS_COLLECTION, poll.id), toFirestorePoll(poll), { merge: true })
    )
  );

  localStorage.setItem(LEGACY_MIGRATION_KEY, 'done');
  return true;
}

export async function fetchPollsFromApi(): Promise<Poll[]> {
  if (!db || !isFirebaseConfigured) return getLocalPolls();

  try {
    const snapshot = await getDocs(collection(db, POLLS_COLLECTION));
    return cacheRemotePolls(snapshot.docs.map(d => d.data() as Poll));
  } catch (error) {
    console.warn('Firestore fetch failed; using cached polls.', error);
    return getLocalPolls();
  }
}

/**
 * Firestore is the source of truth. localStorage is only a cache for offline/error fallback.
 * A one-time legacy migration runs only when Firestore is empty, preserving polls that were
 * created before the app was connected to Firebase.
 */
export function subscribeToPollsFromFirestore(
  onUpdate: (polls: Poll[]) => void,
  onStatus?: (status: FirestoreSyncStatus) => void
): () => void {
  if (!db || !isFirebaseConfigured) {
    console.error('[DNS Firestore] Firebase is not configured.');
    onStatus?.('offline');
    onUpdate(getLocalPolls());
    return () => {};
  }

  onStatus?.('connecting');
  let disposed = false;

  const reportError = (stage: string, error: unknown) => {
    const err = error as { code?: string; message?: string };
    console.error(`[DNS Firestore] ${stage} failed`, {
      code: err?.code || 'unknown',
      message: err?.message || String(error),
      projectId: 'dns-polls',
    });
  };

  const bootstrap = async () => {
    try {
      const snapshot = await Promise.race([
        getDocs(collection(db, POLLS_COLLECTION)),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error('Initial Firestore read timed out after 8s')), 8000)
        ),
      ]);

      if (disposed) return;

      let remotePolls = snapshot.docs.map(d => d.data() as Poll);

      if (remotePolls.length === 0) {
        try {
          const migrated = await migrateLegacyCacheIfNeeded(remotePolls);
          if (migrated) {
            const afterMigration = await getDocs(collection(db, POLLS_COLLECTION));
            remotePolls = afterMigration.docs.map(d => d.data() as Poll);
          }
        } catch (error) {
          reportError('legacy migration', error);
        }
      }

      if (disposed) return;

      onUpdate(cacheRemotePolls(remotePolls));
      onStatus?.('live');
      console.info('[DNS Firestore] Initial read succeeded.', {
        projectId: 'dns-polls',
        polls: remotePolls.length,
      });
    } catch (error) {
      if (disposed) return;
      reportError('initial getDocs', error);
      onStatus?.('offline');
      onUpdate(getLocalPolls());
    }
  };

  void bootstrap();

  const unsubscribe = onSnapshot(
    collection(db, POLLS_COLLECTION),
    snapshot => {
      if (disposed) return;
      const remotePolls = snapshot.docs.map(d => d.data() as Poll);
      onUpdate(cacheRemotePolls(remotePolls));
      onStatus?.('live');
      console.info('[DNS Firestore] Realtime snapshot received.', {
        projectId: 'dns-polls',
        polls: remotePolls.length,
      });
    },
    error => {
      if (disposed) return;
      reportError('realtime listener', error);
      // Do not blank or replace a successful bootstrap result just because
      // realtime transport is temporarily unavailable.
    }
  );

  return () => {
    disposed = true;
    unsubscribe();
  };
}

export const subscribeToPolls = subscribeToPollsFromFirestore;

export async function getPollFromFirestore(pollId: string): Promise<Poll | null> {
  if (!db || !isFirebaseConfigured) {
    return getLocalPolls().find(p => p.id === pollId) || null;
  }

  try {
    const snapshot = await getDoc(doc(db, POLLS_COLLECTION, pollId));
    if (!snapshot.exists()) return null;

    const poll = snapshot.data() as Poll;
    saveLocalPoll(poll);
    return poll;
  } catch (error) {
    console.warn('Firestore poll fetch failed; using cached poll.', error);
    return getLocalPolls().find(p => p.id === pollId) || null;
  }
}

export function subscribeToPoll(
  pollId: string,
  onUpdate: (poll: Poll | null) => void
): () => void {
  if (!db || !isFirebaseConfigured) {
    onUpdate(getLocalPolls().find(p => p.id === pollId) || null);
    return () => {};
  }

  return onSnapshot(
    doc(db, POLLS_COLLECTION, pollId),
    snapshot => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      const poll = snapshot.data() as Poll;
      saveLocalPoll(poll);
      onUpdate(poll);
    },
    error => {
      console.error('Firestore poll subscription failed.', error);
      onUpdate(getLocalPolls().find(p => p.id === pollId) || null);
    }
  );
}

export async function savePollToFirestore(poll: Poll): Promise<void> {
  const updatedPoll: Poll = {
    ...poll,
    updatedAt: new Date().toISOString(),
  };

  if (!db || !isFirebaseConfigured) {
    saveLocalPoll(updatedPoll);
    return;
  }

  await setDoc(
    doc(db, POLLS_COLLECTION, updatedPoll.id),
    toFirestorePoll(updatedPoll),
    { merge: true }
  );
  saveLocalPoll(updatedPoll);
}

export async function deletePollFromFirestore(pollId: string): Promise<void> {
  if (!db || !isFirebaseConfigured) {
    deleteLocalPoll(pollId);
    return;
  }

  await deleteDoc(doc(db, POLLS_COLLECTION, pollId));
  deleteLocalPoll(pollId);
}

export async function submitParticipantVote(
  poll: Poll,
  participantName: string,
  votes: Record<string, VoteStatus>,
  editingParticipantId?: string
): Promise<Poll> {
  const now = new Date().toISOString();

  if (!db || !isFirebaseConfigured) {
    const participants = [...poll.participants];
    const existingIndex = editingParticipantId
      ? participants.findIndex(p => p.id === editingParticipantId)
      : participants.findIndex(
          p => p.name.trim().toLowerCase() === participantName.trim().toLowerCase()
        );

    const participant = existingIndex >= 0
      ? { ...participants[existingIndex], name: participantName, votes, updatedAt: now }
      : {
          id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          name: participantName,
          votes,
          updatedAt: now,
        };

    if (existingIndex >= 0) participants[existingIndex] = participant;
    else participants.push(participant);

    const updated = { ...poll, participants, updatedAt: now };
    saveLocalPoll(updated);
    return updated;
  }

  const pollRef = doc(db, POLLS_COLLECTION, poll.id);
  const updated = await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(pollRef);
    const latestPoll = snapshot.exists() ? (snapshot.data() as Poll) : poll;
    const participants = [...(latestPoll.participants || [])];

    const existingIndex = editingParticipantId
      ? participants.findIndex(p => p.id === editingParticipantId)
      : participants.findIndex(
          p => p.name.trim().toLowerCase() === participantName.trim().toLowerCase()
        );

    const participant = existingIndex >= 0
      ? { ...participants[existingIndex], name: participantName, votes, updatedAt: now }
      : {
          id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          name: participantName,
          votes,
          updatedAt: now,
        };

    if (existingIndex >= 0) participants[existingIndex] = participant;
    else participants.push(participant);

    const nextPoll: Poll = {
      ...latestPoll,
      participants,
      updatedAt: now,
    };

    transaction.set(pollRef, toFirestorePoll(nextPoll), { merge: true });
    return nextPoll;
  });

  saveLocalPoll(updated);
  return updated;
}

export async function finalizePollSlotFirestore(poll: Poll, slotId: string): Promise<Poll> {
  const now = new Date().toISOString();

  if (!db || !isFirebaseConfigured) {
    const updated = {
      ...poll,
      finalizedSlotId: poll.finalizedSlotId === slotId ? undefined : slotId,
      updatedAt: now,
    };
    saveLocalPoll(updated);
    return updated;
  }

  const pollRef = doc(db, POLLS_COLLECTION, poll.id);
  const updated = await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(pollRef);
    const latestPoll = snapshot.exists() ? (snapshot.data() as Poll) : poll;
    const nextPoll: Poll = {
      ...latestPoll,
      finalizedSlotId: latestPoll.finalizedSlotId === slotId ? undefined : slotId,
      updatedAt: now,
    };

    transaction.set(pollRef, toFirestorePoll(nextPoll), { merge: true });
    return nextPoll;
  });

  saveLocalPoll(updated);
  return updated;
}
