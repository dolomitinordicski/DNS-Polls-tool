import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { Participant, ParticipantIdentity, Poll, PrivateParticipantContact, VoteStatus } from '../types';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import {
  deletePoll as deleteLocalPoll,
  getLocalPolls,
  getPollShareUrl as getStorageShareUrl,
  replaceLocalPolls,
  savePoll as saveLocalPoll,
} from './storage';

const POLLS_COLLECTION = 'polls';
const RESPONSES_COLLECTION = 'responses';
const PRIVATE_CONTACTS_COLLECTION = 'privateContacts';
const LEGACY_MIGRATION_KEY = 'dns_polls_firestore_migration_v2';

export type FirestoreSyncStatus = 'connecting' | 'live' | 'offline';

export function getPollShareUrl(poll: Poll): string {
  return getStorageShareUrl(poll);
}

function stripPrivateParticipantFields(participant: Participant): Participant {
  const { email: _email, ...publicParticipant } = participant;
  return publicParticipant;
}

function toFirestorePollDocument(poll: Poll): Record<string, unknown> {
  const { participants: _participants, ...pollDocument } = poll;
  return JSON.parse(JSON.stringify(pollDocument)) as Record<string, unknown>;
}

function fromFirestorePollDocument(data: Record<string, unknown>): Poll {
  const legacyParticipants = Array.isArray(data.participants)
    ? (data.participants as Participant[]).map(stripPrivateParticipantFields)
    : [];

  return {
    ...(data as unknown as Poll),
    participants: legacyParticipants,
  };
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

function responseCollectionRef(pollId: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, POLLS_COLLECTION, pollId, RESPONSES_COLLECTION);
}

function privateContactsCollectionRef(pollId: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, POLLS_COLLECTION, pollId, PRIVATE_CONTACTS_COLLECTION);
}

async function fetchResponses(pollId: string): Promise<Participant[]> {
  if (!db) return [];
  const snapshot = await getDocs(responseCollectionRef(pollId));
  return snapshot.docs.map(d => stripPrivateParticipantFields(d.data() as Participant));
}

async function hydratePollDocument(
  pollId: string,
  data: Record<string, unknown>
): Promise<Poll> {
  const base = fromFirestorePollDocument(data);
  const responses = await fetchResponses(pollId);
  return {
    ...base,
    participants: responses.length > 0 ? responses : base.participants,
  };
}

async function migrateLegacyParticipantsIfNeeded(
  pollDocs: Array<{ id: string; data: () => Record<string, unknown> }>
): Promise<void> {
  if (!db || !auth?.currentUser) return;
  if (localStorage.getItem(LEGACY_MIGRATION_KEY) === 'done') return;

  let hasChanges = false;
  const batch = writeBatch(db);

  for (const pollDoc of pollDocs) {
    const data = pollDoc.data();
    const legacyParticipants = Array.isArray(data.participants)
      ? (data.participants as Participant[])
      : [];

    if (legacyParticipants.length === 0) continue;

    hasChanges = true;

    for (const participant of legacyParticipants) {
      const publicParticipant = stripPrivateParticipantFields(participant);
      const responseId = participant.id || ('p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));

      batch.set(
        doc(db, POLLS_COLLECTION, pollDoc.id, RESPONSES_COLLECTION, responseId),
        {
          ...publicParticipant,
          id: responseId,
        },
        { merge: true }
      );

      if (participant.email) {
        const contactId = 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        batch.set(
          doc(db, POLLS_COLLECTION, pollDoc.id, PRIVATE_CONTACTS_COLLECTION, contactId),
          {
            participantId: responseId,
            email: participant.email.trim().toLowerCase(),
            firstName: participant.firstName || '',
            lastName: participant.lastName || '',
            updatedAt: participant.updatedAt || new Date().toISOString(),
          }
        );
      }
    }

    const cleanPoll = fromFirestorePollDocument(data);
    batch.set(
      doc(db, POLLS_COLLECTION, pollDoc.id),
      toFirestorePollDocument(cleanPoll)
    );
  }

  if (hasChanges) {
    await batch.commit();
  }

  localStorage.setItem(LEGACY_MIGRATION_KEY, 'done');
}

async function migrateLegacyCacheIfNeeded(remotePolls: Poll[]): Promise<boolean> {
  if (!db || remotePolls.length > 0) return false;
  if (localStorage.getItem('dns_polls_firestore_migration_v1') === 'done') return false;

  const legacyPolls = getLocalPolls();
  if (legacyPolls.length === 0) {
    localStorage.setItem('dns_polls_firestore_migration_v1', 'done');
    return false;
  }

  const batch = writeBatch(db);

  for (const poll of legacyPolls) {
    batch.set(
      doc(db, POLLS_COLLECTION, poll.id),
      toFirestorePollDocument(poll),
      { merge: true }
    );

    for (const participant of poll.participants || []) {
      const responseId = participant.id || ('p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
      batch.set(
        doc(db, POLLS_COLLECTION, poll.id, RESPONSES_COLLECTION, responseId),
        {
          ...stripPrivateParticipantFields(participant),
          id: responseId,
        },
        { merge: true }
      );

      if (participant.email) {
        const contactId = 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
        batch.set(
          doc(db, POLLS_COLLECTION, poll.id, PRIVATE_CONTACTS_COLLECTION, contactId),
          {
            participantId: responseId,
            email: participant.email.trim().toLowerCase(),
            firstName: participant.firstName || '',
            lastName: participant.lastName || '',
            updatedAt: participant.updatedAt || new Date().toISOString(),
          }
        );
      }
    }
  }

  await batch.commit();
  localStorage.setItem('dns_polls_firestore_migration_v1', 'done');
  return true;
}

export async function fetchPollsFromApi(): Promise<Poll[]> {
  if (!db || !isFirebaseConfigured) return getLocalPolls();

  try {
    const snapshot = await getDocs(collection(db, POLLS_COLLECTION));
    await migrateLegacyParticipantsIfNeeded(
      snapshot.docs.map(d => ({ id: d.id, data: () => d.data() as Record<string, unknown> }))
    );

    const polls = await Promise.all(
      snapshot.docs.map(d => hydratePollDocument(d.id, d.data() as Record<string, unknown>))
    );

    return cacheRemotePolls(polls);
  } catch (error) {
    console.warn('Firestore fetch failed; using cached polls.', error);
    return getLocalPolls();
  }
}

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

  const publishSnapshot = async (snapshot: Awaited<ReturnType<typeof getDocs>>) => {
    const rawDocs = snapshot.docs.map(d => ({
      id: d.id,
      data: () => d.data() as Record<string, unknown>,
    }));

    try {
      await migrateLegacyParticipantsIfNeeded(rawDocs);
    } catch (error) {
      reportError('legacy participant privacy migration', error);
    }

    const hydrated = await Promise.all(
      snapshot.docs.map(d => hydratePollDocument(d.id, d.data() as Record<string, unknown>))
    );

    if (disposed) return;
    onUpdate(cacheRemotePolls(hydrated));
    onStatus?.('live');
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

      let remotePolls = snapshot.docs.map(d => fromFirestorePollDocument(d.data() as Record<string, unknown>));

      if (remotePolls.length === 0) {
        try {
          const migrated = await migrateLegacyCacheIfNeeded(remotePolls);
          if (migrated) {
            const afterMigration = await getDocs(collection(db, POLLS_COLLECTION));
            await publishSnapshot(afterMigration);
            return;
          }
        } catch (error) {
          reportError('legacy cache migration', error);
        }
      }

      await publishSnapshot(snapshot);
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
      void publishSnapshot(snapshot);
    },
    error => {
      if (disposed) return;
      reportError('realtime listener', error);
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

    const poll = await hydratePollDocument(
      pollId,
      snapshot.data() as Record<string, unknown>
    );
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

  let basePoll: Poll | null = null;
  let responses: Participant[] = [];
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    if (!basePoll) {
      onUpdate(null);
      return;
    }

    onUpdate({
      ...basePoll,
      participants: responses.length > 0 ? responses : basePoll.participants,
    });
  };

  const unsubscribePoll = onSnapshot(
    doc(db, POLLS_COLLECTION, pollId),
    snapshot => {
      if (!snapshot.exists()) {
        basePoll = null;
        emit();
        return;
      }

      basePoll = fromFirestorePollDocument(
        snapshot.data() as Record<string, unknown>
      );
      emit();
    },
    error => {
      console.error('Firestore poll subscription failed.', error);
      onUpdate(null);
    }
  );

  const unsubscribeResponses = onSnapshot(
    responseCollectionRef(pollId),
    snapshot => {
      responses = snapshot.docs.map(d =>
        stripPrivateParticipantFields(d.data() as Participant)
      );
      emit();
    },
    error => {
      console.error('Firestore response subscription failed.', error);
    }
  );

  return () => {
    disposed = true;
    unsubscribePoll();
    unsubscribeResponses();
  };
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
    toFirestorePollDocument(updatedPoll),
    { merge: true }
  );
  saveLocalPoll({
    ...updatedPoll,
    participants: (updatedPoll.participants || []).map(stripPrivateParticipantFields),
  });
}

export async function deletePollFromFirestore(pollId: string): Promise<void> {
  if (!db || !isFirebaseConfigured) {
    deleteLocalPoll(pollId);
    return;
  }

  const [responses, contacts] = await Promise.all([
    getDocs(responseCollectionRef(pollId)),
    getDocs(privateContactsCollectionRef(pollId)),
  ]);

  const batch = writeBatch(db);
  responses.docs.forEach(d => batch.delete(d.ref));
  contacts.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, POLLS_COLLECTION, pollId));
  await batch.commit();

  deleteLocalPoll(pollId);
}

export async function submitParticipantVote(
  poll: Poll,
  identity: ParticipantIdentity,
  votes: Record<string, VoteStatus>,
  editingParticipantId?: string
): Promise<Poll> {
  const now = new Date().toISOString();
  const firstName = identity.firstName.trim();
  const lastName = identity.lastName.trim();
  const email = identity.email.trim().toLowerCase();
  const participantName = [firstName, lastName].filter(Boolean).join(' ');
  const participantId = editingParticipantId ||
    ('p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10));

  const participant: Participant = {
    id: participantId,
    name: participantName,
    firstName,
    lastName,
    votes,
    updatedAt: now,
  };

  if (!db || !isFirebaseConfigured) {
    const participants = [...(poll.participants || [])];
    const existingIndex = editingParticipantId
      ? participants.findIndex(p => p.id === editingParticipantId)
      : -1;

    const localParticipant: Participant = { ...participant, email };

    if (existingIndex >= 0) participants[existingIndex] = localParticipant;
    else participants.push(localParticipant);

    const updated = { ...poll, participants, updatedAt: now };
    saveLocalPoll(updated);
    return updated;
  }

  const batch = writeBatch(db);
  batch.set(
    doc(db, POLLS_COLLECTION, poll.id, RESPONSES_COLLECTION, participantId),
    participant,
    { merge: Boolean(editingParticipantId) }
  );

  const contactId = 'c-' + Date.now() + '-' + Math.random().toString(36).substring(2, 12);
  batch.set(
    doc(db, POLLS_COLLECTION, poll.id, PRIVATE_CONTACTS_COLLECTION, contactId),
    {
      participantId,
      email,
      firstName,
      lastName,
      updatedAt: now,
    }
  );

  batch.update(doc(db, POLLS_COLLECTION, poll.id), { updatedAt: now });
  await batch.commit();

  const participants = [...(poll.participants || [])];
  const existingIndex = editingParticipantId
    ? participants.findIndex(p => p.id === editingParticipantId)
    : -1;

  if (existingIndex >= 0) participants[existingIndex] = participant;
  else participants.push(participant);

  const updated: Poll = { ...poll, participants, updatedAt: now };
  saveLocalPoll(updated);
  return updated;
}

export async function getPrivateContactsForPoll(
  pollId: string
): Promise<PrivateParticipantContact[]> {
  if (!db || !isFirebaseConfigured || !auth?.currentUser) return [];

  const snapshot = await getDocs(privateContactsCollectionRef(pollId));
  return snapshot.docs.map(d => ({
    id: d.id,
    ...(d.data() as Omit<PrivateParticipantContact, 'id'>),
  }));
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
    const latestPoll = snapshot.exists()
      ? fromFirestorePollDocument(snapshot.data() as Record<string, unknown>)
      : poll;

    const nextPoll: Poll = {
      ...latestPoll,
      participants: poll.participants,
      finalizedSlotId: latestPoll.finalizedSlotId === slotId ? undefined : slotId,
      updatedAt: now,
    };

    transaction.set(pollRef, toFirestorePollDocument(nextPoll), { merge: true });
    return nextPoll;
  });

  saveLocalPoll(updated);
  return updated;
}
