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

export interface ParticipantIdentity {
  firstName: string;
  lastName: string;
  email: string;
}

export interface Participant {
  id: string;
  name: string; // Display name kept for backwards compatibility with existing polls
  firstName?: string;
  lastName?: string;
  email?: string; // Scoped to this poll only; never promoted automatically to contact presets
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
  conferenceUrl?: string; // Optional videoconference URL for the confirmed calendar event
  allowMaybe: boolean;
  slots: TimeSlot[];
  participants: Participant[];
  createdAt: string;
  updatedAt?: string;
  finalizedSlotId?: string; // If the organizer finalized a date
}
