import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  Participant,
  ParticipantIdentity,
  Poll,
  PrivateParticipantContact,
  VoteStatus,
} from '../types';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { isAuthorizedPrivateDataUser } from './privateRecipientSync';
import {
  POLLS_COLLECTION,
  PRIVATE_CONTACTS_COLLECTION,
  RESPONSES_COLLECTION,
  fromFirestorePollDocument,
  stripPrivateParticipantFields,
  toFirestorePollDocument,
} from './pollDocuments';
import {
  cachePoll,
  readLegacyPollCache,
  readPollCache,
  removeCachedPoll,
  replacePollCache,
} from './pollCache';

export type FirestoreSyncStatus =
  | 'connecting'
  | 'live'
  | 'cached'
  | 'restricted'
  | 'offline';

export interface FirestoreAccessError {
  code: string;
  message: string;
  stage: string;
}

export interface LegacyPollMigrationResult {
  candidates: number;
  createdPolls: number;
  existingPolls: number;
  responsesUpserted: number;
  privateContactsUpserted: number;
}

function responseCollectionRef(pollId: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, POLLS_COLLECTION, pollId, RESPONSES_COLLECTION);
}

function privateContactsCollectionRef(pollId: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(db, POLLS_COLLECTION, pollId, PRIVATE_CONTACTS_COLLECTION);
}

function normalizeError(stage: string, error: unknown): FirestoreAccessError {
  const err = error as { code?: string; message?: string };
  return {
    code: err?.code || 'unknown',
    message: err?.message || String(error),
    stage,
  };
}

function isPermissionDenied(error: unknown) {
  const code = (error as { code?: string })?.code || '';
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

function reportError(stage: string, error: unknown) {
  const normalized = normalizeError(stage, error);
  console.error(`[DNS Polls Firestore] ${stage} failed`, {
    ...normalized,
    projectId: 'dns-polls',
  });
  return normalized;
}

async function fetchResponses(pollId: string): Promise<Participant[]> {
  if (!db) return [];
  const snapshot = await getDocs(responseCollectionRef(pollId));
  return snapshot.docs.map(item =>
    stripPrivateParticipantFields(item.data() as Participant),
  );
}

async function hydratePollDocument(
  pollId: string,
  data: Record<string, unknown>,
): Promise<Poll> {
  const base = fromFirestorePollDocument(data);
  const responses = await fetchResponses(pollId);

  return {
    ...base,
    participants: responses.length > 0 ? responses : base.participants,
  };
}

async function migrateLegacyPublicDocumentsIfNeeded(
  pollDocs: Array<{ id: string; data: () => Record<string, unknown> }>,
): Promise<void> {
  if (!db) return;

  const legacyDocs = pollDocs.filter(pollDoc => {
    const data = pollDoc.data();
    return Array.isArray(data.participants) && data.participants.length > 0;
  });

  if (legacyDocs.length === 0) return;

  const batch = writeBatch(db);

  for (const pollDoc of legacyDocs) {
    const data = pollDoc.data();
    const legacyParticipants = (data.participants as Participant[]) || [];

    for (const participant of legacyParticipants) {
      const responseId =
        participant.id ||
        `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      batch.set(
        doc(
          db,
          POLLS_COLLECTION,
          pollDoc.id,
          RESPONSES_COLLECTION,
          responseId,
        ),
        {
          ...stripPrivateParticipantFields(participant),
          id: responseId,
        },
        { merge: true },
      );

      if (participant.email) {
        const contactId =
          `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        batch.set(
          doc(
            db,
            POLLS_COLLECTION,
            pollDoc.id,
            PRIVATE_CONTACTS_COLLECTION,
            contactId,
          ),
          {
            participantId: responseId,
            email: participant.email.trim().toLowerCase(),
            firstName: participant.firstName || '',
            lastName: participant.lastName || '',
            updatedAt: participant.updatedAt || new Date().toISOString(),
          },
        );
      }
    }

    const cleanPoll = fromFirestorePollDocument(data);
    batch.set(
      doc(db, POLLS_COLLECTION, pollDoc.id),
      toFirestorePollDocument(cleanPoll),
    );
  }

  await batch.commit();
}

function legacySafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

function fallbackLegacyParticipantId(
  pollId: string,
  participant: Participant,
  index: number,
): string {
  const identity = [
    participant.firstName || '',
    participant.lastName || '',
    participant.name || '',
    participant.email || '',
    String(index),
  ].join('-');

  return `legacy-${legacySafeId(pollId)}-${legacySafeId(identity)}`;
}

async function migrateLegacyCacheIfNeeded(
  remotePollIds: ReadonlySet<string>,
  legacyPolls: Poll[],
): Promise<LegacyPollMigrationResult> {
  const result: LegacyPollMigrationResult = {
    candidates: legacyPolls.length,
    createdPolls: 0,
    existingPolls: 0,
    responsesUpserted: 0,
    privateContactsUpserted: 0,
  };

  if (!db || legacyPolls.length === 0) return result;

  for (const poll of legacyPolls) {
    const batch = writeBatch(db);
    let hasWrites = false;
    const existsRemotely = remotePollIds.has(poll.id);

    if (existsRemotely) {
      result.existingPolls += 1;
    } else {
      batch.set(
        doc(db, POLLS_COLLECTION, poll.id),
        toFirestorePollDocument(poll),
        { merge: true },
      );
      hasWrites = true;
      result.createdPolls += 1;
    }

    for (const [index, participant] of (poll.participants || []).entries()) {
      const responseId =
        participant.id ||
        fallbackLegacyParticipantId(poll.id, participant, index);

      batch.set(
        doc(
          db,
          POLLS_COLLECTION,
          poll.id,
          RESPONSES_COLLECTION,
          responseId,
        ),
        {
          ...stripPrivateParticipantFields(participant),
          id: responseId,
        },
        { merge: true },
      );
      hasWrites = true;
      result.responsesUpserted += 1;

      if (participant.email && !existsRemotely) {
        const contactId = `legacy-${legacySafeId(responseId)}`;

        batch.set(
          doc(
            db,
            POLLS_COLLECTION,
            poll.id,
            PRIVATE_CONTACTS_COLLECTION,
            contactId,
          ),
          {
            participantId: responseId,
            email: participant.email.trim().toLowerCase(),
            firstName: participant.firstName || '',
            lastName: participant.lastName || '',
            updatedAt: participant.updatedAt || new Date().toISOString(),
          },
        );
        hasWrites = true;
        result.privateContactsUpserted += 1;
      }
    }

    if (hasWrites) {
      await batch.commit();
    }
  }

  return result;
}

export async function fetchPolls(): Promise<Poll[]> {
  if (!db || !isFirebaseConfigured) return readPollCache();

  const legacySnapshot = readLegacyPollCache();

  try {
    let snapshot = await getDocs(collection(db, POLLS_COLLECTION));

    try {
      await migrateLegacyCacheIfNeeded(
        new Set(snapshot.docs.map(item => item.id)),
        legacySnapshot,
      );
      snapshot = await getDocs(collection(db, POLLS_COLLECTION));
    } catch (error) {
      reportError('legacy local-cache migration', error);
    }

    try {
      await migrateLegacyPublicDocumentsIfNeeded(
        snapshot.docs.map(item => ({
          id: item.id,
          data: () => item.data() as Record<string, unknown>,
        })),
      );
    } catch (error) {
      reportError('legacy public-document migration', error);
    }

    const polls = await Promise.all(
      snapshot.docs.map(item =>
        hydratePollDocument(
          item.id,
          item.data() as Record<string, unknown>,
        ),
      ),
    );

    return replacePollCache(polls);
  } catch (error) {
    reportError('poll collection fetch', error);
    return readPollCache();
  }
}

export function subscribeToPolls(
  onUpdate: (polls: Poll[]) => void,
  onStatus?: (status: FirestoreSyncStatus) => void,
  onAccessError?: (error: FirestoreAccessError | null) => void,
): () => void {
  if (!db || !isFirebaseConfigured) {
    onAccessError?.(null);
    onStatus?.('offline');
    onUpdate(readPollCache());
    return () => {};
  }

  // Capture the legacy browser data before any Firestore snapshot is allowed
  // to replace the local cache. This closes the P.2 startup race that could
  // erase the only copy of older polls before migration read them.
  const legacySnapshot = readLegacyPollCache();

  onStatus?.('connecting');
  onAccessError?.(null);

  let disposed = false;
  let unsubscribeRemote: (() => void) | null = null;

  const publishSnapshot = async (
    snapshot: Awaited<ReturnType<typeof getDocs>>,
  ) => {
    const rawDocs = snapshot.docs.map(item => ({
      id: item.id,
      data: () => item.data() as Record<string, unknown>,
    }));

    try {
      await migrateLegacyPublicDocumentsIfNeeded(rawDocs);
    } catch (error) {
      reportError('legacy public-document migration', error);
    }

    const hydrated = await Promise.all(
      snapshot.docs.map(item =>
        hydratePollDocument(
          item.id,
          item.data() as Record<string, unknown>,
        ),
      ),
    );

    if (disposed) return;

    onAccessError?.(null);
    onUpdate(replacePollCache(hydrated));
    onStatus?.('live');
  };

  const publishFallback = (
    status: Exclude<FirestoreSyncStatus, 'connecting' | 'live'>,
  ) => {
    if (disposed) return;
    onUpdate(readPollCache());
    onStatus?.(status);
  };

  const attachRemoteListener = () => {
    if (disposed || unsubscribeRemote) return;

    unsubscribeRemote = onSnapshot(
      collection(db, POLLS_COLLECTION),
      snapshot => {
        void publishSnapshot(snapshot);
      },
      error => {
        if (disposed) return;

        const normalized = reportError('poll collection listener', error);
        if (isPermissionDenied(error)) {
          onAccessError?.(normalized);
          publishFallback('restricted');
        } else {
          onAccessError?.(normalized);
          publishFallback(readPollCache().length > 0 ? 'cached' : 'offline');
        }
      },
    );
  };

  const bootstrap = async () => {
    try {
      let snapshot = await Promise.race([
        getDocs(collection(db, POLLS_COLLECTION)),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error('Initial Firestore read timed out after 8s')),
            8000,
          ),
        ),
      ]);

      if (disposed) return;

      try {
        const migration = await migrateLegacyCacheIfNeeded(
          new Set(snapshot.docs.map(item => item.id)),
          legacySnapshot,
        );

        if (
          migration.createdPolls > 0 ||
          migration.responsesUpserted > 0 ||
          migration.privateContactsUpserted > 0
        ) {
          snapshot = await getDocs(collection(db, POLLS_COLLECTION));
        }
      } catch (error) {
        reportError('legacy local-cache migration', error);
      }

      await publishSnapshot(snapshot);
    } catch (error) {
      if (disposed) return;

      const normalized = reportError('initial poll collection read', error);
      if (isPermissionDenied(error)) {
        onAccessError?.(normalized);
        publishFallback('restricted');
      } else {
        onAccessError?.(normalized);
        publishFallback(readPollCache().length > 0 ? 'cached' : 'offline');
      }
    } finally {
      attachRemoteListener();
    }
  };

  void bootstrap();

  return () => {
    disposed = true;
    unsubscribeRemote?.();
  };
}

export async function importLegacyPollsNow(): Promise<LegacyPollMigrationResult> {
  const legacySnapshot = readLegacyPollCache();

  if (!db || !isFirebaseConfigured) {
    return {
      candidates: legacySnapshot.length,
      createdPolls: 0,
      existingPolls: 0,
      responsesUpserted: 0,
      privateContactsUpserted: 0,
    };
  }

  const snapshot = await getDocs(collection(db, POLLS_COLLECTION));
  return migrateLegacyCacheIfNeeded(
    new Set(snapshot.docs.map(item => item.id)),
    legacySnapshot,
  );
}

export async function getPoll(pollId: string): Promise<Poll | null> {
  if (!db || !isFirebaseConfigured) {
    return readPollCache().find(poll => poll.id === pollId) || null;
  }

  try {
    const snapshot = await getDoc(doc(db, POLLS_COLLECTION, pollId));
    if (!snapshot.exists()) return null;

    const poll = await hydratePollDocument(
      pollId,
      snapshot.data() as Record<string, unknown>,
    );

    cachePoll(poll);
    return poll;
  } catch (error) {
    reportError('single poll fetch', error);
    return readPollCache().find(poll => poll.id === pollId) || null;
  }
}

export function subscribeToPoll(
  pollId: string,
  onUpdate: (poll: Poll | null) => void,
): () => void {
  if (!db || !isFirebaseConfigured) {
    onUpdate(readPollCache().find(poll => poll.id === pollId) || null);
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

    const hydrated = {
      ...basePoll,
      participants: responses.length > 0 ? responses : basePoll.participants,
    };

    cachePoll(hydrated);
    onUpdate(hydrated);
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
        snapshot.data() as Record<string, unknown>,
      );
      emit();
    },
    error => {
      reportError('single poll listener', error);
      onUpdate(
        readPollCache().find(poll => poll.id === pollId) || null,
      );
    },
  );

  const unsubscribeResponses = onSnapshot(
    responseCollectionRef(pollId),
    snapshot => {
      responses = snapshot.docs.map(item =>
        stripPrivateParticipantFields(item.data() as Participant),
      );
      emit();
    },
    error => {
      reportError('poll responses listener', error);
    },
  );

  return () => {
    disposed = true;
    unsubscribePoll();
    unsubscribeResponses();
  };
}

export async function savePoll(poll: Poll): Promise<void> {
  const updatedPoll: Poll = {
    ...poll,
    updatedAt: new Date().toISOString(),
  };

  if (!db || !isFirebaseConfigured) {
    cachePoll(updatedPoll);
    return;
  }

  await setDoc(
    doc(db, POLLS_COLLECTION, updatedPoll.id),
    toFirestorePollDocument(updatedPoll),
    { merge: true },
  );

  cachePoll(updatedPoll);
}

export async function deletePoll(pollId: string): Promise<void> {
  if (!db || !isFirebaseConfigured) {
    removeCachedPoll(pollId);
    return;
  }

  if (!auth || !isAuthorizedPrivateDataUser(auth.currentUser)) {
    throw new Error('private-admin-auth-required');
  }

  const [responses, contacts] = await Promise.all([
    getDocs(responseCollectionRef(pollId)),
    getDocs(privateContactsCollectionRef(pollId)),
  ]);

  const batch = writeBatch(db);

  responses.docs.forEach(item => batch.delete(item.ref));
  contacts.docs.forEach(item => batch.delete(item.ref));
  batch.delete(doc(db, POLLS_COLLECTION, pollId));

  await batch.commit();
  removeCachedPoll(pollId);
}

export async function submitParticipantVote(
  poll: Poll,
  identity: ParticipantIdentity,
  votes: Record<string, VoteStatus>,
  editingParticipantId?: string,
): Promise<Poll> {
  const now = new Date().toISOString();
  const firstName = identity.firstName.trim();
  const lastName = identity.lastName.trim();
  const email = identity.email.trim().toLowerCase();
  const participantName = [firstName, lastName].filter(Boolean).join(' ');
  const participantId =
    editingParticipantId ||
    `p-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

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
      ? participants.findIndex(item => item.id === editingParticipantId)
      : -1;

    const localParticipant: Participant = {
      ...participant,
      email,
    };

    if (existingIndex >= 0) participants[existingIndex] = localParticipant;
    else participants.push(localParticipant);

    const updated = {
      ...poll,
      participants,
      updatedAt: now,
    };

    cachePoll(updated);
    return updated;
  }

  const batch = writeBatch(db);

  batch.set(
    doc(
      db,
      POLLS_COLLECTION,
      poll.id,
      RESPONSES_COLLECTION,
      participantId,
    ),
    participant,
    { merge: Boolean(editingParticipantId) },
  );

  const contactId = `participant-${participantId}`;

  batch.set(
    doc(
      db,
      POLLS_COLLECTION,
      poll.id,
      PRIVATE_CONTACTS_COLLECTION,
      contactId,
    ),
    {
      participantId,
      email,
      firstName,
      lastName,
      updatedAt: now,
    },
    { merge: true },
  );

  batch.update(
    doc(db, POLLS_COLLECTION, poll.id),
    { updatedAt: now },
  );

  await batch.commit();

  const participants = [...(poll.participants || [])];
  const existingIndex = editingParticipantId
    ? participants.findIndex(item => item.id === editingParticipantId)
    : -1;

  if (existingIndex >= 0) participants[existingIndex] = participant;
  else participants.push(participant);

  const updated: Poll = {
    ...poll,
    participants,
    updatedAt: now,
  };

  cachePoll(updated);
  return updated;
}

export async function getPrivateContacts(
  pollId: string,
): Promise<PrivateParticipantContact[]> {
  if (!db || !isFirebaseConfigured || !auth?.currentUser) return [];

  const snapshot = await getDocs(privateContactsCollectionRef(pollId));
  const latestByParticipant = new Map<string, PrivateParticipantContact>();

  snapshot.docs.forEach(item => {
    const data = item.data() as Omit<PrivateParticipantContact, 'id'>;
    if (
      !data.participantId ||
      !data.email ||
      data.participantId.startsWith('invitee-')
    ) {
      return;
    }

    const contact: PrivateParticipantContact = {
      id: item.id,
      ...data,
    };

    const previous = latestByParticipant.get(contact.participantId);
    if (!previous || contact.updatedAt >= previous.updatedAt) {
      latestByParticipant.set(contact.participantId, contact);
    }
  });

  return [...latestByParticipant.values()].sort((a, b) =>
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName),
  );
}

export async function finalizePollSlot(
  poll: Poll,
  slotId: string,
): Promise<Poll> {
  const now = new Date().toISOString();

  if (!db || !isFirebaseConfigured) {
    const updated = {
      ...poll,
      finalizedSlotId:
        poll.finalizedSlotId === slotId ? undefined : slotId,
      updatedAt: now,
    };

    cachePoll(updated);
    return updated;
  }

  const pollRef = doc(db, POLLS_COLLECTION, poll.id);

  const updated = await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(pollRef);
    const latestPoll = snapshot.exists()
      ? fromFirestorePollDocument(
          snapshot.data() as Record<string, unknown>,
        )
      : poll;

    const nextPoll: Poll = {
      ...latestPoll,
      participants: poll.participants,
      finalizedSlotId:
        latestPoll.finalizedSlotId === slotId ? undefined : slotId,
      updatedAt: now,
    };

    transaction.set(
      pollRef,
      toFirestorePollDocument(nextPoll),
      { merge: true },
    );

    return nextPoll;
  });

  cachePoll(updated);
  return updated;
}
