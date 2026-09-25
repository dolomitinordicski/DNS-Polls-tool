import { boolean, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { TimeSlot, Participant } from '../types.ts';

// 'users' table linked to Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 'polls' table storing poll details, time slots, and participant votes
export const polls = pgTable('polls', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  organizerName: text('organizer_name').notNull(),
  organizerEmail: text('organizer_email'),
  allowMaybe: boolean('allow_maybe').default(true).notNull(),
  slots: jsonb('slots').$type<TimeSlot[]>().notNull(),
  participants: jsonb('participants').$type<Participant[]>().notNull(),
  finalizedSlotId: text('finalized_slot_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
