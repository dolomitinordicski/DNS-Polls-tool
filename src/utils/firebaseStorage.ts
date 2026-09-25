import { Poll, Participant, VoteStatus } from '../types';
import { getLocalPolls, savePoll as saveLocalPoll, deletePoll as deleteLocalPoll, getPollShareUrl as getStorageShareUrl } from './storage';

export function getPollShareUrl(poll: Poll): string {
  return getStorageShareUrl(poll);
}

function mergeParticipants(p1: Participant[] = [], p2: Participant[] = []): Participant[] {
  const map = new Map<string, Participant>();
  p1.forEach(p => map.set(p.id, p));
  p2.forEach(p => {
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
    } else {
      const pTime = p.updatedAt || '';
      const exTime = existing.updatedAt || '';
      if (pTime > exTime || Object.keys(p.votes || {}).length > Object.keys(existing.votes || {}).length) {
        map.set(p.id, p);
      }
    }
  });
  return Array.from(map.values());
}

function mergeLocalAndRemotePolls(remotePolls: Poll[]): Poll[] {
  const localPolls = getLocalPolls();
  const pollMap = new Map<string, Poll>();

  remotePolls.forEach(p => pollMap.set(p.id, p));

  localPolls.forEach(local => {
    const remote = pollMap.get(local.id);
    if (!remote) {
      pollMap.set(local.id, local);
    } else {
      const mergedParticipants = mergeParticipants(remote.participants || [], local.participants || []);
      const localTime = local.updatedAt || local.createdAt || '';
      const remoteTime = remote.updatedAt || remote.createdAt || '';
      const isLocalNewer = localTime >= remoteTime;

      const mergedPoll: Poll = {
        ...(isLocalNewer ? local : remote),
        participants: mergedParticipants,
        slots: isLocalNewer ? local.slots : (remote.slots || local.slots)
      };
      pollMap.set(local.id, mergedPoll);
      saveLocalPoll(mergedPoll);
    }
  });

  return Array.from(pollMap.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchPollsFromApi(): Promise<Poll[]> {
  try {
    const response = await fetch('/api/polls');
    if (response.ok) {
      const remotePolls = await response.json();
      return mergeLocalAndRemotePolls(remotePolls);
    }
  } catch (err) {
    // Local fallback
  }
  return getLocalPolls();
}

/**
  Subscribes to polls via backend API with fallback to local storage
*/
export function subscribeToPollsFromFirestore(onUpdate: (polls: Poll[]) => void): () => void {
  let active = true;

  const pollApi = async () => {
    if (!active) return;
    const merged = await fetchPollsFromApi();
    if (active) {
      onUpdate(merged);
    }
  };

  pollApi();
  const intervalId = setInterval(pollApi, 3000);

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

export const subscribeToPolls = subscribeToPollsFromFirestore;

export async function getPollFromFirestore(pollId: string): Promise<Poll | null> {
  try {
    const response = await fetch(`/api/polls/${pollId}`);
    if (response.ok) {
      const poll = await response.json();
      if (poll) {
        saveLocalPoll(poll);
        return poll;
      }
    }
  } catch (err) {
    // Local fallback
  }
  return getLocalPolls().find(p => p.id === pollId) || null;
}

export function subscribeToPoll(pollId: string, onUpdate: (poll: Poll | null) => void): () => void {
  let active = true;

  const pollApi = async () => {
    if (!active) return;
    const poll = await getPollFromFirestore(pollId);
    if (active) {
      onUpdate(poll);
    }
  };

  pollApi();
  const intervalId = setInterval(pollApi, 3000);

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}

export async function savePollToFirestore(poll: Poll): Promise<void> {
  const updatedPoll: Poll = {
    ...poll,
    updatedAt: new Date().toISOString()
  };

  saveLocalPoll(updatedPoll);

  try {
    await fetch('/api/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedPoll),
    });
  } catch (err) {
    // Local fallback
  }
}

export async function deletePollFromFirestore(pollId: string): Promise<void> {
  deleteLocalPoll(pollId);
  try {
    await fetch(`/api/polls/${pollId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    // Local fallback
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
      const newParticipant: Participant = {
        id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: participantName,
        votes,
        updatedAt: now
      };
      updatedParticipants.push(newParticipant);
    }
  }

  const updatedPoll: Poll = {
    ...latestPoll,
    participants: updatedParticipants
  };

  await savePollToFirestore(updatedPoll);
  return updatedPoll;
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
