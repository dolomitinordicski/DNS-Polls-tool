export type VoteStatus = 'yes' | 'maybe' | 'no';

export interface TimeSlot {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // e.g. "09:00 - 10:30" or "Tutto il giorno"
}

export interface ParticipantVote {
  slotId: string;
  status: VoteStatus;
}

export interface Participant {
  id: string;
  name: string;
  votes: Record<string, VoteStatus>; // slotId -> VoteStatus
  updatedAt: string;
}

export interface Poll {
  id: string;
  title: string;
  description?: string;
  location?: string;
  organizerName: string;
  organizerEmail?: string;
  allowMaybe: boolean;
  slots: TimeSlot[];
  participants: Participant[];
  createdAt: string;
  updatedAt?: string;
  finalizedSlotId?: string; // If the organizer finalized a date
}
