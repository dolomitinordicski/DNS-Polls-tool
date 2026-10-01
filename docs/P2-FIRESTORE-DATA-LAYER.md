# DNS Polls — P.2 Firestore / Data Layer

Date: 2026-10-01

## Goal

Make Firestore the authoritative Polls data source, restore reliable access to
previously created/sent polls, and remove persistence knowledge from React views.

P.2 does not redesign the Dashboard, Create Poll or Poll Detail views. Those
remain later phases.

## Source-of-truth model

### Firestore

Firestore project: `dns-polls`

Canonical structure:

```text
polls/{pollId}
  responses/{responseId}
  privateContacts/{contactId}
```

Responsibilities:

- `polls/{pollId}`: public poll definition and scheduling state;
- `responses/{responseId}`: public participant availability, without e-mail;
- `privateContacts/{contactId}`: private e-mail/contact records.

Participant e-mail addresses never belong in public response documents.

### Browser cache

`localStorage` is a cache/fallback only.

It is used for:

- temporary offline rendering;
- migration of very old local-only Polls data;
- last-known local recovery.

It is not the canonical list of polls and must never be presented as equivalent
to a live Firestore collection.

The cache is sanitized before persistence so Firestore participant e-mails are
not copied back into the ordinary Polls cache.

## Data-layer architecture

```text
src/data/
  pollDocuments.ts
  pollCache.ts
  pollRepository.ts

src/utils/firebaseStorage.ts
  compatibility facade only
```

### pollDocuments

Owns:

- public/private participant projection;
- poll document serialization;
- poll hydration;
- canonical sorting.

### pollCache

Owns:

- cache read;
- cache replacement;
- cache removal;
- explicit legacy-cache access used only by migration.

### pollRepository

Owns:

- Firestore paths;
- full-list subscription;
- single-poll subscription;
- poll CRUD;
- response CRUD;
- private contact reads;
- finalization;
- cache fallback;
- legacy migration;
- Firestore access-state reporting.

React components keep using the old `firebaseStorage` imports for now. The file
is intentionally reduced to a compatibility facade so later UI phases do not
have to change persistence behavior again.

## Restoring previously sent polls

The previous regression had two parts:

1. the dashboard attempted to enumerate `polls`;
2. deployed/committed rules reserve collection `list` access for the DNS admin.

The application used to swallow that permission error and show only the local
browser cache. A different browser therefore appeared to have "lost" old polls.

P.2 changes this behavior.

### Progressive administrative access

The dashboard first attempts the live Firestore collection.

- If collection access is allowed, it remains open and works normally.
- If Firestore returns `permission-denied`, Polls reports `restricted`.
- The UI then asks for the approved DNS Google account.
- After authentication, the collection listener is recreated automatically.
- The complete Firestore poll list becomes authoritative again.

Public share links are unaffected. A known `pollId` remains readable without
admin login and never subscribes to the full poll collection.

## Firebase application isolation

Polls and DNS_Core are separate Firebase projects.

Before P.2, Polls initialized Firebase with `getApps()[0]`. Since P.1 also
initializes a named DNS_Core application for Foundation tokens, relying on the
first Firebase app was no longer safe.

P.2 gives Polls its own explicit named Firebase app:

`dns-polls-app`

The Foundation design-system connection continues to use its independent
`dns-core-design-system` app.

This prevents the Polls repository from accidentally binding to DNS_Core.

## Legacy privacy migration

When an authenticated admin reads the collection, P.2 checks old poll documents
for legacy embedded `participants`.

If found:

1. public participant responses are copied to `responses`;
2. participant e-mails are copied to `privateContacts`;
3. the embedded participant array is removed from the parent poll document.

The migration is data-driven and idempotent; it no longer relies on a browser
flag to decide whether old Firestore documents are clean.

## Private contact behavior

`privateContacts` remains admin-readable only.

Participant submissions may create a contact record because the participant
must be able to submit their own e-mail without authenticating. Repeated edits
can therefore create more than one private contact record for the same
participant. Admin reads deduplicate by `participantId` and keep the most
recent record.

## Poll deletion

With an authenticated admin session, deletion removes:

- response documents;
- private contact documents;
- parent poll document.

Without an admin session, private contacts are not read from the client. This
preserves the privacy boundary. Secure deployed rules already require admin
rights for poll deletion, so normal production deletion follows the complete
cleanup path.

## Organizer e-mail

`organizerEmail` remains a legacy public poll field in P.2.

Moving it into private metadata requires a coordinated Firestore rules/schema
deployment and authenticated hydration path. Doing that in the same rollout as
the list recovery would risk making existing Create/Edit flows incompatible
with the currently deployed rules.

Participant e-mail privacy is already enforced. Organizer contact migration is
therefore explicitly deferred to a controlled schema revision rather than being
silently changed in P.2.

## Security boundary

Committed Firestore behavior remains:

- known poll: public `get`;
- poll collection: admin-only `list`;
- poll create/delete: admin-only;
- public response: readable;
- participant response create: validated;
- participant e-mail/private contacts: not publicly readable;
- administrative private-contact reads: authenticated DNS admin only.

P.2 fixes the application to respect and react to this boundary instead of
weakening it.

## Rollback

Pre-P.2 branch:

`backup/pre-p2-data-layer-2026-10-01`
