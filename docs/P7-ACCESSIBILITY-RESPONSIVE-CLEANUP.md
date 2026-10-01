# DNS Polls — P.7 Accessibility, Responsive & Final Cleanup

Date: 2026-10-01

## Goal

Close the Polls refactor with a final technical and UI audit.

P.7 does not change the poll model, vote logic, Firestore collections or Firestore
security rules.

The step focuses on:

- keyboard accessibility;
- dialog behavior;
- responsive behavior;
- Foundation consistency;
- removal of dead legacy architecture;
- dependency cleanup.

## Accessibility

### Shared Accessibility runtime

The existing DNS shared Accessibility module remains the primary user-facing
accessibility control.

P.7 adds baseline browser safeguards around it:

- visible keyboard focus;
- larger coarse-pointer touch targets;
- disabled-control cursor feedback;
- `prefers-reduced-motion` support.

### Dialog behavior

A shared `useAccessibleDialog` helper now provides:

- initial focus;
- Tab / Shift+Tab focus trap;
- Escape to close;
- focus restoration after closing;
- background scroll lock.

It is used by:

- Share dialog;
- Edit Poll dialog;
- Calendar day detail dialog.

Dialogs now expose:

- `role="dialog"`;
- `aria-modal="true"`;
- labelled headings;
- keyboard-reachable close controls.

The Edit Poll dialog cannot be dismissed while a save operation is running.

## Responsive cleanup

### Header

The DNS header now uses tighter small-screen spacing and typography while
preserving the canonical shared navigation/runtime.

The obsolete authentication state branch is removed.

### Share dialog

The Share workflow is rebuilt on Foundation controls.

Small screens now receive:

- stacked URL controls;
- stacked recipient controls;
- one-column-safe sharing actions;
- bounded `dvh` dialog height;
- internal scrolling rather than viewport overflow.

### Edit Poll dialog

The edit workflow is rebuilt on Foundation controls.

Date rows switch from desktop grid to stacked mobile controls, with full-width
delete/add actions where needed.

### Calendar

The P.6 calendar retains horizontal overflow for the monthly grid and now uses
the same accessible dialog behavior as the other modal surfaces.

## Foundation cleanup

The final remaining `slate-*` dashboard state styling has been replaced with
DNS tokens.

The application root now reports the actual loaded Foundation version instead
of a stale hard-coded version.

Footer values are bound to Foundation footer tokens.

The header no longer carries unused:

- `adminEmail`;
- `onSignOut`;
- `isAdminLocked`;
- Google sign-out UI.

Quick Share is only offered while a poll detail is actually active.

## Dashboard semantics

Desktop poll rows are no longer clickable non-semantic containers containing
nested interactive buttons.

The poll title is now the explicit keyboard-accessible open action.

The search input has an accessible label.

## Edit Poll safety

P.7 also fixes two cleanup issues in the edit flow:

- slot sorting no longer mutates React state in place;
- deleting the currently finalized slot automatically clears the stale
  `finalizedSlotId`.

## Legacy architecture removed

DNS Polls is now explicitly a:

`Vite + React + TypeScript + Firestore + GitHub Pages`

application.

The unused AI Studio / server architecture is removed:

- `server.ts`;
- Express API;
- Gemini server parser;
- Cloud SQL;
- Drizzle ORM;
- Postgres;
- Firebase Admin middleware;
- old AdminLogin component;
- AI Studio metadata;
- AI Studio asset metadata;
- obsolete Bun lockfile.

The Create Poll text assistant remains the local client-side parser introduced
in P.4.

## Build cleanup

The build is simplified from:

`vite build + esbuild server.ts`

to:

`vite build`

The development command is now plain:

`vite`

Unused server dependencies and environment settings are removed.

The Vite and TypeScript configurations are reduced to the frontend architecture
actually deployed by GitHub Pages.

## Privacy boundary

P.7 deliberately retains client Firebase Auth initialization in the repository
data layer only because protected `privateContacts` reads/cleanup are still
defined behind an authenticated boundary.

The obsolete Google Auth provider and all authentication UI are removed.

No private e-mail data is moved into public poll documents.

## Unchanged

P.7 does not modify:

- `firestore.rules`;
- poll document schema;
- response schema;
- `privateContacts` schema;
- poll repository persistence behavior;
- P.4 Create Poll logic;
- P.5 participant voting logic;
- P.6 finalization/ICS logic.

## Rollback

Pre-P.7 branch:

`backup/pre-p7-accessibility-cleanup-2026-10-01`
