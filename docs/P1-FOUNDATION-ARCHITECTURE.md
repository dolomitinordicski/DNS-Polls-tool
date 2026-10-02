# DNS Polls — Foundation Architecture

Date: 2026-10-03

## Current contract

DNS Polls consumes the immutable DNS Foundation release `foundation-v1.2.0`.

Foundation owns:
- Design System variables and shared UI primitives;
- operational shell, header/navigation and scroll behavior;
- DE-first language preference and persistence;
- Accessibility runtime;
- motion and interaction runtimes;
- footer runtime;
- overlays and confirmation semantics;
- capability runtime for clipboard and calendar export;
- immutable DNS brand assets.

Polls owns:
- poll creation, editing, voting and finalization;
- Firestore collections and synchronization;
- invitee and organizer workflows;
- private recipient handling and GDPR deletion;
- Polls-specific calendar/ICS content;
- local parser and poll-domain presentation.

## Runtime boundary

`src/main.tsx` initializes Foundation before React renders.

`src/lib/foundation.ts` is the only Polls bridge to shared Foundation runtime
services. Polls does not load a second Design System from DNS Core and does not
reimplement shared tokens, motion, navigation, accessibility or footer behavior.

DNS Core is still consumed read-only for shared status/master-data checks, but
it is not a runtime Design System source.

## Capability boundary

Clipboard actions use `clipboard.copy`.

Outlook/ICS export uses `calendar.ics` with a Polls adapter because the Polls
format intentionally includes Europe/Rome timezone data, organizer, attendees,
RSVP semantics and conference metadata beyond the generic Foundation event
shape.

## Asset boundary

The DNS web logo is resolved from the same immutable Foundation release tag as
the package dependency. No DNS brand image is copied into this repository.

## Persistence boundary

Foundation migration does not change:
- Firestore rules;
- poll, response or privateContacts schemas;
- local cache/migration behavior;
- authentication policy.

These remain Polls-owned domain responsibilities.
