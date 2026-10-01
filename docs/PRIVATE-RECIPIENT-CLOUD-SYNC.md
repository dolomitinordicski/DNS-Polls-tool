# DNS Polls — Private recipient cloud sync

Date: 2026-10-01

## Goal

Keep DNS Polls operational without authentication while allowing the organizer's
poll-specific recipient list to be available across browsers without exposing
private e-mail addresses publicly.

## Architecture

Public Polls remains open in the current temporary operational mode.

Authentication is **not** an application gate.

Google authentication is used only for private recipient data and only when the
organizer explicitly enables private cloud sync.

Authorized account:

`management@dolomitinordicski.com`

Firestore Security Rules remain unchanged.

## Storage

The existing protected subcollection is reused:

`polls/{pollId}/privateContacts`

Two logical record types coexist:

- participant contacts: normal participant IDs;
- initial invitees: `invitee-*` participant IDs.

Invitee e-mails are never written into:

- the public poll document;
- public response documents;
- URL parameters.

The existing participant-contact API explicitly filters out `invitee-*`
records, so participant and invitation semantics remain separate.

## Local-first behavior

The existing browser store remains the operational fallback:

`dns_polls_poll_recipients_v1`

Without authentication:

- Create Poll saves recipients locally;
- Share uses the local list;
- Finalization / ICS uses the local list;
- Polls itself remains fully usable.

With the authorized DNS account:

- the local list is mirrored to protected Firestore;
- an existing protected cloud list is loaded into the local browser;
- if the cloud list is empty and a local list exists, the local list is migrated
  into protected Firestore;
- Share and Finalization therefore reuse the same list across authenticated
  browsers.

## Create Poll

The organizer can connect private cloud sync before creating a poll.

After the poll document is created, the recipient list is:

1. saved locally;
2. mirrored to protected Firestore when the private admin session is active.

Cloud-sync failure never invalidates poll creation; local storage remains the
fallback.

## Share / Finalization

Both surfaces expose the same non-blocking private-sync control.

When an authorized session becomes available, the protected cloud recipient
list is refreshed automatically.

Saving the recipient list updates:

- local browser storage;
- protected Firestore when authorized.

ICS export first saves the latest list through the same local-first sync path,
then writes those addresses as calendar attendees.

## Security boundary

The current Firestore rule already provides the required boundary:

- create of validated `privateContacts` records is permitted for participant
  submission;
- read/update/delete requires the authorized DNS admin account.

No public read access to recipient e-mail addresses is added.

## Authentication behavior

Authentication is never required to:

- open DNS Polls;
- list polls;
- create/edit/delete polls;
- answer a poll;
- use local recipient lists;
- generate an ICS from the current browser.

It is required only to retrieve or replace private recipient data across
browsers.

## Failure behavior

If Google authentication or protected Firestore access is unavailable:

- Polls remains open;
- the recipient list remains local;
- the UI reports the private-sync failure without blocking the workflow.
