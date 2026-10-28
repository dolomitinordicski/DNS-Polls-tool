import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { DNSEvent, EventRegistration } from './types';
import { eventsBridgeEnabled, managedEventCreate, managedEventsList } from './bridge';

function requireDb() {
  if (!db) throw new Error('DNS Polls Firestore not configured');
  return db;
}

export function eventUrl(id: string): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('event', id);
  return url.toString();
}

export async function getEvent(id: string): Promise<DNSEvent | null> {
  const result = await getDoc(doc(requireDb(), 'events', id));
  return result.exists() ? result.data() as DNSEvent : null;
}

export async function listEvents(): Promise<DNSEvent[]> {
  if (eventsBridgeEnabled) return managedEventsList();
  const result = await getDocs(collection(requireDb(), 'events'));
  return result.docs.map(item => item.data() as DNSEvent)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export async function createEvent(data: Omit<DNSEvent, 'id' | 'createdAt' | 'schemaVersion'>): Promise<DNSEvent> {
  if (eventsBridgeEnabled) return managedEventCreate(data);
  const event: DNSEvent = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  };
  await setDoc(doc(requireDb(), 'events', event.id), event);
  return event;
}

export async function registerForEvent(eventId: string, data: Omit<EventRegistration, 'id' | 'createdAt'>): Promise<void> {
  const registration: EventRegistration = {
    ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(),
  };
  await setDoc(doc(requireDb(), 'events', eventId, 'registrations', registration.id), registration);
}

export async function listRegistrations(eventId: string): Promise<EventRegistration[]> {
  const results = await getDocs(collection(requireDb(), 'events', eventId, 'registrations'));
  return results.docs.map(item => item.data() as EventRegistration);
}
