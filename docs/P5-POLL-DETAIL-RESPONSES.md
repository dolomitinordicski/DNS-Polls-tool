# DNS Polls — P.5 Poll Detail + Responses

Date: 2026-10-01

## Goal

Refactor the poll detail experience into two clearly separated modes:

- participant / invitee response flow;
- organizer management and response overview.

P.5 keeps the P.2 Firestore repository and the P.4 creation flow unchanged.

## Participant experience

The invitee view is no longer an administrator screen with controls hidden.

It now provides a dedicated response path:

1. poll context and status;
2. concise invitation guidance;
3. participant identity;
4. one explicit availability decision per proposed slot;
5. response submission;
6. team response overview.

### Explicit availability controls

The previous cyclic vote button is removed.

Each slot now exposes explicit choices:

- Yes / Ja / Sì;
- If needed / Falls nötig / Se necessario, when enabled;
- No / Nein / No.

This prevents accidental state changes and makes the selected response visible at
all times.

Every proposed slot must be answered before submission.

### Participant privacy

The existing P.2 behavior remains unchanged:

- e-mail is required for a response;
- e-mail is stored in the private contact collection;
- public response documents do not contain participant e-mail;
- the interface states that the address is scoped to this poll.

## Organizer experience

The organizer detail view now uses the Foundation hierarchy:

- poll status and metadata;
- response count;
- number of proposed slots;
- current best availability;
- description / agenda;
- best or confirmed date;
- management actions.

Administrative actions are grouped consistently:

- invitee preview;
- edit poll;
- copy link;
- share;
- delete.

## Response matrix

The organizer receives a compact horizontal response matrix with:

- participants on the sticky first column;
- one column per date/time option;
- aggregate Yes / Maybe / No values;
- best-option marker;
- confirmed-date marker;
- participant edit entry point.

The same matrix is visible below the invitee response form as a transparent team
summary, preserving the previous shared-response behavior.

## Organizer response editing

Existing organizer editing behavior is retained.

Because participant e-mails are no longer part of public response documents,
editing an existing participant may require the organizer to enter the e-mail
again before saving. P.5 does not weaken the private-contact boundary to restore
the old embedded e-mail behavior.

## Finalization

P.5 preserves the existing finalization function and gives it Foundation styling.

A dedicated P.6 step remains responsible for the deeper redesign of:

- calendar;
- final appointment workflow;
- videoconference handling;
- ICS generation/final confirmation.

## Calendar

Invitees are intentionally not shown the organizer calendar/tab switch.

The organizer can still switch between:

- availability / response view;
- calendar view.

The Calendar component itself is not refactored in P.5.

## Finalized poll export

The existing finalized-poll behavior remains available:

- optional videoconference URL;
- saved into the poll;
- iCal export;
- conference URL included in the generated ICS.

Its workflow is visually aligned but structurally deferred to P.6.

## Data boundary

P.5 does not modify:

- Firestore collections;
- Firestore rules;
- P.2 pollRepository;
- public/private contact separation;
- poll creation schema;
- participant submission schema.

## Rollback

Pre-P.5 branch:

`backup/pre-p5-detail-responses-2026-10-01`
