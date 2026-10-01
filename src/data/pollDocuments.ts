import { Participant, Poll } from '../types';

export const POLLS_COLLECTION = 'polls';
export const RESPONSES_COLLECTION = 'responses';
export const PRIVATE_CONTACTS_COLLECTION = 'privateContacts';

export function stripPrivateParticipantFields(
  participant: Participant,
): Participant {
  const { email: _email, ...publicParticipant } = participant;
  return publicParticipant;
}

export function toFirestorePollDocument(
  poll: Poll,
): Record<string, unknown> {
  const { participants: _participants, ...pollDocument } = poll;
  return JSON.parse(JSON.stringify(pollDocument)) as Record<string, unknown>;
}

export function fromFirestorePollDocument(
  data: Record<string, unknown>,
): Poll {
  const legacyParticipants = Array.isArray(data.participants)
    ? (data.participants as Participant[]).map(stripPrivateParticipantFields)
    : [];

  return {
    ...(data as unknown as Poll),
    participants: legacyParticipants,
  };
}

export function publicPollForCache(poll: Poll): Poll {
  return {
    ...poll,
    participants: (poll.participants || []).map(stripPrivateParticipantFields),
  };
}

export function sortPolls(polls: Poll[]): Poll[] {
  return [...polls].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );
}
