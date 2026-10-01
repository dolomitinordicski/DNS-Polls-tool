import {
  Participant,
  Poll,
  PrivateParticipantContact,
} from '../types';

export const POLLS_COLLECTION = 'polls';
export const RESPONSES_COLLECTION = 'responses';
export const PRIVATE_CONTACTS_COLLECTION = 'privateContacts';

export type FirestorePollDocument = Omit<Poll, 'participants' | 'organizerEmail'> & {
  participants?: never;
  organizerEmail?: never;
};

export interface PrivateOrganizerContact {
  id: string;
  contactType: 'organizer';
  email: string;
  organizerName: string;
  updatedAt: string;
}

export type RawPrivateContact =
  | Omit<PrivateParticipantContact, 'id'>
  | Omit<PrivateOrganizerContact, 'id'>;

export function stripPrivateParticipantFields(
  participant: Participant,
): Participant {
  const { email: _email, ...publicParticipant } = participant;
  return publicParticipant;
}

export function toFirestorePollDocument(
  poll: Poll,
): Record<string, unknown> {
  const {
    participants: _participants,
    organizerEmail: _organizerEmail,
    ...pollDocument
  } = poll;

  return JSON.parse(JSON.stringify(pollDocument)) as Record<string, unknown>;
}

export function fromFirestorePollDocument(
  data: Record<string, unknown>,
): Poll {
  const legacyParticipants = Array.isArray(data.participants)
    ? (data.participants as Participant[]).map(stripPrivateParticipantFields)
    : [];

  const {
    organizerEmail: legacyOrganizerEmail,
    participants: _participants,
    ...publicData
  } = data as Record<string, unknown> & {
    organizerEmail?: unknown;
    participants?: unknown;
  };

  return {
    ...(publicData as unknown as Omit<Poll, 'participants'>),
    // organizerEmail is intentionally not hydrated from the public document.
    // A legacy value is retained only in memory long enough for migration.
    organizerEmail:
      typeof legacyOrganizerEmail === 'string'
        ? legacyOrganizerEmail
        : undefined,
    participants: legacyParticipants,
  };
}

export function publicPollForCache(poll: Poll): Poll {
  const {
    organizerEmail: _organizerEmail,
    participants,
    ...publicPoll
  } = poll;

  return {
    ...publicPoll,
    participants: (participants || []).map(stripPrivateParticipantFields),
  };
}

export function sortPolls(polls: Poll[]): Poll[] {
  return [...polls].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );
}

export function isParticipantPrivateContact(
  value: RawPrivateContact,
): value is Omit<PrivateParticipantContact, 'id'> {
  return (
    'participantId' in value &&
    typeof value.participantId === 'string' &&
    !('contactType' in value)
  );
}
