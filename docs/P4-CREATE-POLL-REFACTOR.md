# DNS Polls — P.4 Create Poll Refactor

Date: 2026-10-01

## Goal

Refactor the Create Poll workflow onto the DNS Foundation without changing the
P.2 persistence contract.

The create flow now prioritizes a clear operational sequence:

1. optional local text assistant;
2. meeting details;
3. date/time options;
4. response mode;
5. creation summary.

## Main changes

### No pre-filled fake dates

A new poll now starts with zero date options.

The previous form inserted three future demo slots automatically. This created a
risk that an administrator could publish a poll containing dates that were never
explicitly chosen.

P.4 requires at least one real date option before creation.

### Text assistant

The existing local parser is retained and explicitly presented as a local tool.

It can:

- extract title;
- extract description;
- detect location;
- extract explicit or relative dates;
- extract time ranges;
- populate the manual form.

The parser does not call an external AI API.

The optional ChatGPT helper remains available behind a secondary disclosure and
supports IT / DE / EN copy instructions.

### Meeting details

Foundation form controls are used for:

- title;
- organizer;
- organizer e-mail;
- location / meeting platform;
- description / agenda.

Existing autocomplete behavior is preserved.

### Date options

The scheduling area now has one compact input row:

- date;
- time range;
- add option.

Quick time presets follow the practical DNS meeting pattern:

- 08:00–09:30;
- 10:00–11:30;
- 14:00–15:30;
- 16:00–17:30;
- all day.

Added dates are grouped chronologically by day. Every time value remains
editable inline and every slot can be deleted individually.

### Response mode

The "Maybe / Falls nötig / Se necessario" setting is separated from date
creation and presented as a dedicated response-mode section.

### Creation summary

Desktop uses a sticky summary panel showing:

- meeting details complete / missing;
- number of date options;
- active response mode;
- poll title / context preview;
- primary Create Poll action;
- secondary Cancel action.

On smaller screens the same panel flows naturally below the form.

### Submit behavior

P.4 adds an explicit saving state to prevent duplicate creation clicks.

Native HTML validation remains active for required and e-mail fields, while the
existing application validation remains the authoritative domain check for:

- title;
- organizer;
- at least one date option.

## Removed legacy patterns

- promotional top banner;
- AI-styled prompt card;
- duplicate visual language between manual and prompt creation;
- pre-filled demo date options;
- ad-hoc slate/hex control styling;
- separate bottom action bar disconnected from form completeness.

## Data boundary

P.4 does not modify:

- Firestore collection structure;
- P.2 poll repository;
- Firestore rules;
- authentication;
- participant responses;
- private contacts;
- finalization.

The resulting `Poll` object is persisted through the same
`savePollToFirestore` compatibility facade backed by P.2.

## Rollback

Pre-P.4 branch:

`backup/pre-p4-create-poll-2026-10-01`
