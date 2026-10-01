# DNS Polls — P.6 Calendar, Finalization & ICS

Date: 2026-10-01

## Goal

Complete the last major legacy workflow in DNS Polls:

- monthly calendar;
- final-date confirmation;
- online/in-person event preparation;
- Outlook/iCalendar export.

P.6 keeps the P.2 Firestore repository and privacy boundary unchanged.

## Calendar

The calendar is rebuilt on the DNS Foundation.

It now provides:

- Foundation card hierarchy;
- month navigation;
- Today shortcut;
- poll filter;
- status legend;
- horizontal overflow on small screens instead of compressed unreadable cells;
- accessible day buttons;
- explicit markers for best and confirmed slots;
- compact day detail dialog;
- Yes / Maybe / No availability summary;
- direct navigation back to the poll.

The calendar continues to support:

- all polls from the main Calendar view;
- a single poll from Poll Detail.

## Finalization

Finalization is removed from the response matrix and moved into a dedicated
`FinalizationPanel`.

The organizer can:

1. compare all date/time options;
2. inspect Yes / Maybe / No totals;
3. see the current best option;
4. select the intended final slot;
5. confirm it explicitly;
6. change the final slot;
7. reopen the poll by removing the confirmation.

The underlying P.2 `finalizePollSlotFirestore` transaction is unchanged.

## Online vs in-person

P.6 derives meeting type from:

- the poll location;
- a saved videoconference URL.

For online meetings the organizer can save a conference link after finalization.
The link remains stored in the existing `conferenceUrl` poll field.

In-person meetings keep the physical `location` value.

## Poll-specific recipient list

A new local recipient store is introduced:

`dns_polls_poll_recipients_v1`

The organizer can paste recipient e-mail addresses:

- while sharing the poll;
- or during finalization.

The same poll-specific list is then reused for the Outlook ICS export.

### Privacy decision

Recipient e-mails are **not** added to the public poll document.

They are stored only in the organizer browser's localStorage and are therefore:

- poll-specific;
- not publicly readable through Firestore;
- not synchronized across browsers;
- removable by clearing the field and saving it.

This is an interim operational solution. A future authenticated/private DNS
contact service can replace the local store without changing the ICS interface.

## ICS architecture

ICS generation is moved from the generic `storage.ts` utility into:

`src/utils/ical.ts`

The old `storage.ts` export remains as a compatibility re-export.

### Outlook/iCalendar content

The final ICS now includes:

- confirmed event status;
- organizer;
- poll title;
- physical location or Online;
- conference URL;
- poll description;
- short confirmation / thank-you message;
- Europe/Rome timezone definition;
- busy status;
- attendees from the local poll-specific recipient list.

When attendees are present the calendar uses:

`METHOD:REQUEST`

and emits one `ATTENDEE` line per normalized recipient.

Without attendees it falls back to:

`METHOD:PUBLISH`

### Time handling

Timed slots use:

`TZID=Europe/Rome`

with embedded CET/CEST timezone rules.

All-day slots use date-only DTSTART/DTEND values.

## Share workflow integration

The Share modal now contains the same local recipient list.

This allows the organizer to:

1. create the poll;
2. open Share;
3. paste the e-mail addresses used to distribute the poll;
4. save them locally;
5. collect responses;
6. finalize the poll later;
7. download an ICS that already contains those attendees.

## Boundaries

P.6 does not modify:

- Firestore collections;
- Firestore security rules;
- P.2 pollRepository;
- response schema;
- participant privateContacts;
- Create Poll schema.

The open operational access hotfix remains intact.

## Rollback

Pre-P.6 branch:

`backup/pre-p6-calendar-finalization-2026-10-01`
