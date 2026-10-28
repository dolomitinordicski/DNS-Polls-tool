export type EventQuestionType = 'text' | 'select' | 'checkbox';

export interface EventQuestion {
  id: string;
  label: string;
  type: EventQuestionType;
  required: boolean;
  options?: string[];
}

export interface DNSEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  status: 'open' | 'closed';
  questions: EventQuestion[];
  createdAt: string;
  schemaVersion: 1;
}

export interface EventRegistration {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  answers: Record<string, string | boolean>;
  createdAt: string;
}
