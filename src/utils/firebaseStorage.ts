import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { Poll, Participant, VoteStatus } from '../types';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  getLocalPolls,
  savePoll as saveLocalPoll,
  deletePoll as deleteLocalPoll,
  getPollShareUrl as getStorageShareUrl
} from './storage';

const POLLS_COLLECTION = 'polls';

export function getPollShareUrl(poll: Poll): string {
  return getStorageShareUrl(poll);
}

function toFirestorePoll(poll: Poll): Poll {
  // Firestore rejects undefined values. JSON serialization also guarantees
  // that we only send plain serializable data.
  return JSON.parse(JSON.stringify(poll)) as Poll;
}

function mergeParticipants(p1: Participant[] = [], p2: Participant[] = []): Participant[] {
  const map = new Map<string, Participant>();

  p1.forEach(p => map.set(p.id, p));
  p2.forEach(p => {
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
      return;
    }

    const pTime = p.updatedAt || '';
    const existingTime = existing.updatedAt || '';
    if (
      pTime > existingTime ||
      Object.keys(p.votes || {}).length > Object.keys(existing.votes || {}).length
    ) {
      map.set(p.id, p);
    }
  });

  return Array.from(map.values());
}

function mergeLocalAndRemotePolls(remotePolls: Poll[]): Poll[] {
  const localPolls = getLocalPolls();
  const pollMap = new Map<string, Poll>();

  remotePolls.forEach(remote => {
    pollMap.set(remote.id, remote);
    saveLocalPoll(remote);
  });

  localPolls.forEach(local => {
    const remote = pollMap.get(local.id);

    if (!remote) {
      pollMap.set(local.id, local);
      return;
    }

    const mergedParticipants = mergeParticipants(remote.participants || [], local.participants || []);
    const localTime = local.updatedAt || local.createdAt || '';
    const remoteTime = remote.updatedAt || remote.createdAt || '';
    const isLocalNewer = localTime > remoteTime;

    const mergedPoll: Poll = {
      ...(isLocalNewer ? local : remote),
      participants: mergedParticipants,
      slots: isLocalNewer ? local.slots : (remote.slots || local.slots)
    };

    pollMap.set(local.id, mergedPoll);
    saveLocalPoll(mergedPoll);
  });

  return Array.from(pollMap.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
}

async function migrateLocalPollsToFirestore(remotePolls: Poll[]): Promise<void> {
  if (!db) return;

  const remoteMap = new Map(remotePolls.map(p => [p.id, p]));
  const localPolls = getLocalPolls();

  await Promise.all(
    localPolls.map(async local => {
      const remote = remoteMap.get(local.id);
      const localTime = local.updatedAt || local.createdAt || '';
      const remoteTime = remote?.updatedAt || remote?.createdAt || '';

      if (!remote || localTime > remoteTime) {
        await setDoc(
          doc(db, POLLS_COLLECTION, local.id),
          toFirestorePoll(local),
          { merge: true }
        );
      }
    })
  );
}

export async function fetchPollsFromApi(): Promise<Poll[]> {
  // Kept for compatibility with older imports. Firestore is now the backend.
  if (!db) return getLocalPolls();

  try {
    const snapshot = await getDocs(collection(db, POLLS_COLLECTION));
    const remotePolls = snapshot.docs.map(d => d.data() as Poll);
    return mergeLocalAndRemotePolls(remotePolls);
  } catch (error) {
    console.warn('Firestore fetch failed; using local cache.', error);
    return getLocalPolls();
  }
}

/**
 * Real-time subscription to the shared Firestore polls collection.
 * Falls back to localStorage when Firebase is not configured or unavailable.
 */
export function subscribeToPollsFromFirestore(onUpdate: (polls: Poll[]) => void): () => void {
  if (!db || !isFirebaseConfigured) {
    onUpdate(getLocalPolls());
    return () => {};
  }

  let didMigrateLocal = false;

  const unsubscribe = onSnapshot(
    collection(db, POLLS_COLLECTION),
    snapshot => {
      const remotePolls = snapshot.docs.map(d => d.data() as Poll);
      const mergedPolls = mergeLocalAndRemotePolls(remotePolls);
      onUpdate(mergedPolls);

      if (!didMigrateLocal) {
        didMigrateLocal = true;
        void migrateLocalPollsToFirestore(remotePolls).catch(error => {
          console.warn('Local-to-Firestore migration failed.', error);
        });
      }
    },
    error => {
      console.error('Firestore realtime subscription failed.', error);
      onUpdate(getLocalPolls());
    }
  );

  return unsubscribe;
}

export const subscribeToPolls = subscribeToPollsFromFirestore;

export async function getPollFromFirestore(pollId: string): Promise<Poll | null> {
  if (!db || !isFirebaseConfigured) {
    return getLocalPolls().find(p => p.id === pollId) || null;
  }

  try {
    const snapshot = await getDoc(doc(db, POLLS_COLLECTION, pollId));

    if (snapshot.exists()) {
      const poll = snapshot.data() as Poll;
      saveLocalPoll(poll);
      return poll;
    }
  } catch (error) {
    console.warn('Firestore poll fetch failed; using local cache.', error);
  }

  return getLocalPolls().find(p => p.id === pollId) || null;
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
    updatedAt: new Date().toISOString()
  };

  saveLocalPoll(updatedPoll);

  if (!db || !isFirebaseConfigured) return;

  try {
    await setDoc(
      doc(db, POLLS_COLLECTION, updatedPoll.id),
      toFirestorePoll(updatedPoll),
      { merge: true }
    );
  } catch (error) {
    console.error('Firestore poll save failed; poll kept locally.', error);
    throw error;
  }
}

export async function deletePollFromFirestore(pollId: string): Promise<void> {
  deleteLocalPoll(pollId);

  if (!db || !isFirebaseConfigured) return;

  try {
    await deleteDoc(doc(db, POLLS_COLLECTION, pollId));
  } catch (error) {
    console.error('Firestore poll deletion failed.', error);
    throw error;
  }
}

export async function submitParticipantVote(
  poll: Poll,
  participantName: string,
  votes: Record<string, VoteStatus>,
  editingParticipantId?: string
): Promise<Poll> {
  const latestPoll = (await getPollFromFirestore(poll.id)) || poll;
  const updatedParticipants = [...latestPoll.participants];
  const now = new Date().toISOString();

  if (editingParticipantId) {
    const index = updatedParticipants.findIndex(p => p.id === editingParticipantId);
    if (index >= 0) {
      updatedParticipants[index] = {
        ...updatedParticipants[index],
        name: participantName,
        votes,
        updatedAt: now
      };
    }
  } else {
    const existingIndex = updatedParticipants.findIndex(
      p => p.name.trim().toLowerCase() === participantName.trim().toLowerCase()
    );

    if (existingIndex >= 0) {
      updatedParticipants[existingIndex] = {
        ...updatedParticipants[existingIndex],
        name: participantName,
        votes,
        updatedAt: now
      };
    } else {
      updatedParticipants.push({
        id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: participantName,
        votes,
        updatedAt: now
      });
    }
  }

  const updatedPoll: Poll = {
    ...latestPoll,
    participants: updatedParticipants
  };

  await savePollToFirestore(updatedPoll);
  return {
    ...updatedPoll,
    updatedAt: new Date().toISOString()
  };
}

export async function finalizePollSlotFirestore(poll: Poll, slotId: string): Promise<Poll> {
  const latestPoll = (await getPollFromFirestore(poll.id)) || poll;
  const updatedPoll: Poll = {
    ...latestPoll,
    finalizedSlotId: latestPoll.finalizedSlotId === slotId ? undefined : slotId
  };

  await savePollToFirestore(updatedPoll);
  return updatedPoll;
}
