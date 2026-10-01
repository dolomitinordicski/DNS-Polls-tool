# DNS Polls — P.1 Foundation Architecture Audit

Date: 2026-10-01

## Scope

P.1 aligns the DNS Polls application shell with the canonical DNS Foundation without changing poll-domain behavior or Firestore persistence rules.

Canonical references:

- DNS Foundation v1.2
- DNS Design System v1.12.1
- shared motion runtime
- shared interaction runtime
- shared accessibility runtime
- shared navigation runtime
- DNS_Core `designSystem/current`

## Before P.1

DNS Polls already consumed an earlier pinned version of `dns-shared-data` for motion and interaction, but the application shell still owned several local behaviors:

- hard-coded design tokens in `src/index.css`;
- local header geometry;
- local tab/navigation styling;
- no shared Foundation accessibility module;
- no DNS_Core design-system runtime load;
- no shared measured sticky navigation/progress behavior.

The poll data model, Firestore synchronization and invitee flows were intentionally not part of this step.

## P.1 architecture

### Canonical design source

`@dolomitinordicski/dns-shared-data` is pinned to Foundation / Design System v1.12.1.

Runtime resolution:

1. apply the versioned package fallback immediately;
2. read `DNS_Core/designSystem/current`;
3. deep-merge the remote declarative payload over the fallback;
4. apply CSS variables;
5. re-initialize motion/interaction only when their runtime signature changes.

No executable code is loaded from Firestore.

### Shared behavior

The application shell now consumes:

- `ui/motion`
- `ui/interaction`
- `ui/accessibility`
- `ui/navigation`

Navigation owns:

- measured sticky header/navigation offsets;
- scroll progress;
- canonical tab geometry and active state;
- responsive horizontal/wrapped behavior.

Accessibility owns:

- text scale;
- high contrast;
- relaxed spacing;
- reduced motion;
- stronger focus;
- comfortable density;
- local-only browser persistence.

### Polls-specific exceptions retained

These remain application responsibilities:

- invitee mode;
- poll title context strip;
- DE/IT language switch;
- Polls navigation labels;
- quick share action;
- poll views and workflow state.

Tool-specific navigation content is retained; navigation behavior is not reimplemented.

## Explicitly deferred to P.2

P.1 does not modify:

- Firestore rules;
- collection permissions;
- poll import/list behavior;
- localStorage migration behavior;
- `polls / responses / privateContacts` persistence;
- authentication policy.

The known Firestore collection-list regression is therefore still tracked for P.2.

## Rollback point

Pre-refactor branch:

`backup/pre-foundation-p1-2026-10-01`
