import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-dns-polls';
const rules = readFileSync('firestore.rules', 'utf8');
const validEvent = (id, status = 'open') => ({
  id, title: 'DNS Workshop', description: 'Workshop',
  location: 'Dobbiaco', startsAt: '2026-11-20T10:00',
  status, questions: [], createdAt: '2026-10-28T12:00:00Z', schemaVersion: 1,
});
const validRegistration = (id) => ({
  id, firstName: 'Test', lastName: 'Participant',
  email: 'participant@example.com', answers: {}, createdAt: '2026-10-28T12:00:00Z',
});

let env;
let guest;
let admin;
let outsider;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
  guest = env.unauthenticatedContext().firestore();
  admin = env.authenticatedContext('manager', {
    email: 'management@dolomitinordicski.com',
  }).firestore();
  outsider = env.authenticatedContext('outsider', {
    email: 'outsider@example.com',
  }).firestore();

  await env.withSecurityRulesDisabled(async context => {
    const store = context.firestore();
    await setDoc(doc(store, 'events', 'event-open'), validEvent('event-open'));
    await setDoc(doc(store, 'events', 'event-closed'), validEvent('event-closed', 'closed'));
    await setDoc(doc(store, 'events', 'event-draft'), validEvent('event-draft', 'draft'));
  });
});
after(async () => { await env?.cleanup(); });

test('public can open a shared event but cannot list all events', async () => {
  await assertSucceeds(getDoc(doc(guest, 'events', 'event-open')));
  await assertSucceeds(getDoc(doc(guest, 'events', 'event-closed')));
  await assertFails(getDoc(doc(guest, 'events', 'event-draft')));
  await assertFails(getDocs(collection(guest, 'events')));
});

test('only the DNS organizer can create or change an event', async () => {
  await assertFails(setDoc(doc(guest, 'events', 'guest-event'), validEvent('guest-event')));
  await assertFails(setDoc(doc(outsider, 'events', 'foreign-event'), validEvent('foreign-event')));
  await assertSucceeds(setDoc(doc(admin, 'events', 'admin-event'), validEvent('admin-event')));
  await assertFails(updateDoc(doc(guest, 'events', 'event-open'), { title: 'Changed' }));
});

test('guest may register but cannot read or edit registrations', async () => {
  const id = 'registration-0123456789012345';
  const record = doc(guest, 'events', 'event-open', 'registrations', id);
  await assertSucceeds(setDoc(record, validRegistration(id)));
  await assertFails(getDoc(record));
  await assertFails(getDocs(collection(guest, 'events', 'event-open', 'registrations')));
  await assertFails(updateDoc(record, { firstName: 'Altered' }));
  await assertFails(deleteDoc(record));
  await assertSucceeds(getDoc(doc(admin, 'events', 'event-open', 'registrations', id)));
});

test('invalid and closed-event registrations are blocked', async () => {
  const id = 'registration-9876543210987654';
  await assertFails(setDoc(
    doc(guest, 'events', 'event-closed', 'registrations', id), validRegistration(id),
  ));
  await assertFails(setDoc(
    doc(guest, 'events', 'event-open', 'registrations', id),
    { ...validRegistration(id), email: 'invalid-email' },
  ));
  await assertFails(setDoc(
    doc(guest, 'events', 'event-open', 'registrations', id),
    { ...validRegistration(id), internalNotes: 'unexpected' },
  ));
  await assertFails(setDoc(
    doc(guest, 'events', 'event-open', 'registrations', id),
    { ...validRegistration(id), id: 'wrong-id' },
  ));
});
