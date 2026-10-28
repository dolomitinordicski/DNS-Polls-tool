import {
  collection,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import {
  POLLS_COLLECTION,
  PRIVATE_CONTACTS_COLLECTION,
} from './pollDocuments';

const ADMIN_EMAIL = 'management@dolomitinordicski.com';
const INVITEE_PREFIX = 'invitee-';

export type PrivateRecipientAuthState =
  | 'unavailable'
  | 'signed-out'
  | 'authorized'
  | 'unauthorized';

export function isAuthorizedPrivateDataUser(user: User | null): boolean {
  return Boolean(
    user?.email &&
    user.email.trim().toLowerCase() === ADMIN_EMAIL,
  );
}

export function getPrivateRecipientAuthState(): PrivateRecipientAuthState {
  if (!auth || !db) return 'unavailable';
  if (!auth.currentUser) return 'signed-out';
  return isAuthorizedPrivateDataUser(auth.currentUser)
    ? 'authorized'
    : 'unauthorized';
}

export function subscribePrivateRecipientAuth(
  onChange: (state: PrivateRecipientAuthState, user: User | null) => void,
): () => void {
  if (!auth || !db) {
    onChange('unavailable', null);
    return () => {};
  }

  return onAuthStateChanged(auth, user => {
    if (!user) {
      onChange('signed-out', null);
      return;
    }

    onChange(
      isAuthorizedPrivateDataUser(user) ? 'authorized' : 'unauthorized',
      user,
    );
  });
}

export async function signInPrivateRecipientSync(accountHint = ''): Promise<User> {
  if (!auth || !db) {
    throw new Error('Firebase private data sync is unavailable.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
    ...(accountHint.trim() ? { login_hint: accountHint.trim() } : {}),
  });

  let result;

  try {
    result = await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string })?.code || '';

    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Google Authentication non è ancora abilitato nel progetto Firebase dns-polls.',
      );
    }

    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'dolomitinordicski.github.io non è autorizzato in Firebase Authentication del progetto dns-polls.',
      );
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Il browser ha bloccato la finestra Google. Abilita i popup per questo sito.');
    }
    if (code === 'auth/popup-closed-by-user') {
      throw new Error('Finestra di accesso Google chiusa senza completare la selezione.');
    }

    throw error;
  }

  if (!isAuthorizedPrivateDataUser(result.user)) {
    const selectedEmail = result.user.email || '(email non disponibile)';
    await signOut(auth);
    throw new Error(
      `Google ha usato ${selectedEmail}. DNS Polls autorizza soltanto ${ADMIN_EMAIL}.`,
    );
  }

  return result.user;
}

export async function ensurePrivateDataAdminSession(): Promise<User> {
  if (auth?.currentUser && isAuthorizedPrivateDataUser(auth.currentUser)) {
    return auth.currentUser;
  }

  return signInPrivateRecipientSync();
}

export async function signOutPrivateRecipientSync(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

async function inviteeIdForEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  return `${INVITEE_PREFIX}${hex.slice(0, 32)}`;
}

function privateContactsRef(pollId: string) {
  if (!db) throw new Error('Firestore is not configured.');
  return collection(
    db,
    POLLS_COLLECTION,
    pollId,
    PRIVATE_CONTACTS_COLLECTION,
  );
}

function canonicalParticipantContactId(participantId: string): string {
  return `participant-${participantId}`;
}

async function compactParticipantContacts(pollId: string): Promise<void> {
  if (!db || !auth || !isAuthorizedPrivateDataUser(auth.currentUser)) {
    return;
  }

  const snapshot = await getDocs(privateContactsRef(pollId));
  const latestByParticipant = new Map<
    string,
    {
      participantId: string;
      email: string;
      firstName: string;
      lastName: string;
      updatedAt: string;
    }
  >();

  snapshot.docs.forEach(item => {
    const data = item.data() as {
      participantId?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      updatedAt?: string;
    };

    if (
      !data.participantId ||
      !data.email ||
      data.participantId.startsWith(INVITEE_PREFIX)
    ) {
      return;
    }

    const normalized = {
      participantId: data.participantId,
      email: data.email.trim().toLowerCase(),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      updatedAt: data.updatedAt || '',
    };

    const previous = latestByParticipant.get(data.participantId);
    if (
      !previous ||
      normalized.updatedAt >= previous.updatedAt
    ) {
      latestByParticipant.set(data.participantId, normalized);
    }
  });

  if (latestByParticipant.size === 0) return;

  const batch = writeBatch(db);
  let hasWrites = false;

  for (const [participantId, latest] of latestByParticipant) {
    const canonicalId = canonicalParticipantContactId(participantId);
    const canonicalRef = doc(
      db,
      POLLS_COLLECTION,
      pollId,
      PRIVATE_CONTACTS_COLLECTION,
      canonicalId,
    );

    batch.set(canonicalRef, latest, { merge: true });
    hasWrites = true;

    snapshot.docs.forEach(item => {
      const data = item.data() as { participantId?: string };
      if (
        data.participantId === participantId &&
        item.id !== canonicalId
      ) {
        batch.delete(item.ref);
      }
    });
  }

  if (hasWrites) {
    await batch.commit();
  }
}

export async function loadPrivatePollRecipients(
  pollId: string,
): Promise<string[]> {
  if (!db || !auth || !isAuthorizedPrivateDataUser(auth.currentUser)) {
    return [];
  }

  await compactParticipantContacts(pollId);

  const snapshot = await getDocs(privateContactsRef(pollId));
  const emails = new Set<string>();

  snapshot.docs.forEach(item => {
    const data = item.data() as {
      participantId?: string;
      email?: string;
    };

    if (
      data.participantId?.startsWith(INVITEE_PREFIX) &&
      data.email
    ) {
      emails.add(data.email.trim().toLowerCase());
    }
  });

  return [...emails].sort();
}

export async function replacePrivatePollRecipients(
  pollId: string,
  emails: string[],
): Promise<void> {
  if (!db || !auth || !isAuthorizedPrivateDataUser(auth.currentUser)) {
    throw new Error('Private recipient sync requires the DNS admin account.');
  }

  const existing = await getDocs(privateContactsRef(pollId));
  const deleteBatch = writeBatch(db);
  let deleteCount = 0;

  existing.docs.forEach(item => {
    const data = item.data() as { participantId?: string };
    if (data.participantId?.startsWith(INVITEE_PREFIX)) {
      deleteBatch.delete(item.ref);
      deleteCount += 1;
    }
  });

  if (deleteCount > 0) {
    await deleteBatch.commit();
  }

  if (emails.length === 0) return;

  const write = writeBatch(db);
  const now = new Date().toISOString();

  for (const email of emails) {
    const inviteeId = await inviteeIdForEmail(email);

    write.set(
      doc(
        db,
        POLLS_COLLECTION,
        pollId,
        PRIVATE_CONTACTS_COLLECTION,
        inviteeId,
      ),
      {
        participantId: inviteeId,
        email: email.trim().toLowerCase(),
        firstName: '',
        lastName: '',
        updatedAt: now,
      },
    );
  }

  await write.commit();
}
