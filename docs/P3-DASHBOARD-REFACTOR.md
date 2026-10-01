# DNS Polls — P.3 Dashboard Refactor

Date: 2026-10-01

## Goal

Replace the legacy card-heavy Polls landing page with a Foundation-aligned
operational dashboard while preserving all P.2 data-layer behavior.

## Design principles

- one primary action per dashboard;
- no AI-styled or duplicate creation call-to-action;
- Foundation tokens/components instead of ad-hoc slate/hex styling;
- operational information before decoration;
- consistent desktop and mobile hierarchy;
- Firestore source state visible to the administrator;
- destructive actions remain secondary and visually isolated.

## Dashboard structure

```text
Foundation header
Foundation navigation
Dashboard
  Intro / actions
  KPI strip
  Poll management panel
    source status
    search
    lifecycle filters
    poll list
Foundation footer
```

### Intro

The dashboard uses the standard DNS card language:

- kicker;
- concise heading;
- short operational description;
- secondary Calendar action;
- one primary New Poll action.

The old dashboard-level "create with prompt" button is removed. Prompt-based
creation can remain part of the Create Poll workflow where it belongs.

### KPI strip

Three canonical KPI cards:

- active polls;
- collected responses;
- confirmed future dates.

Expired polls do not count as active.

### Poll lifecycle filters

The dashboard derives a presentation-only lifecycle without changing the Poll
schema:

- `open`: no finalized slot and at least one non-past option;
- `confirmed`: finalized slot exists and is not in the past;
- `expired`: finalized slot is past, or all available slots are past.

Filters:

- All;
- Open;
- Confirmed;
- Expired.

This is a view concern only; no lifecycle value is persisted to Firestore.

### Data-source state

The dashboard displays the current P.2 repository state:

- Firestore live;
- connecting;
- local cache;
- protected access;
- offline.

This makes fallback state visible instead of presenting cached data as if it
were live data.

### Desktop list

Desktop uses a compact management list with stable columns:

- status;
- poll;
- organizer;
- responses;
- relevant date;
- actions.

Row click opens a poll. Explicit controls remain available for keyboard users:

- copy link;
- edit;
- delete;
- open.

### Mobile

On smaller screens each list row collapses into a compact operational card.
The information hierarchy is retained and actions remain explicit.

## Removed legacy patterns

P.3 removes from the dashboard:

- the promotional welcome-banner treatment;
- duplicate creation CTAs;
- dashboard-level "Mit Prompt erstellen / Crea con Prompt";
- inconsistent button shapes/colors;
- large decorative poll-card grid;
- "AI-like" recommended badges;
- hard-coded dashboard hex colors where Foundation tokens already exist.

## Data and behavior boundaries

P.3 does not modify:

- Firestore paths;
- Firestore rules;
- cache behavior;
- authentication;
- poll document schema;
- response submission;
- private contacts;
- finalization logic.

All persistence remains owned by P.2 `pollRepository`.

## Rollback

Pre-P.3 branch:

`backup/pre-p3-dashboard-2026-10-01`
