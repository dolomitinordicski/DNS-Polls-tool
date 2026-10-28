# DNS Polls — verified activation stages

## Current state
- DNS Foundation v1.3.0 and Events/Forms code are merged.
- The existing `firebase-rules.yml` workflow successfully deployed the Event rules to **dns-polls** on 2026-10-28 (GitHub Actions run 40685534139).
- **Stage A:** organizer Events dashboard is enabled on GitHub Pages, behind the existing DNS Google login.
- **Stage B:** public registration is off until a specific event-registration privacy notice, retention handling, abuse protection and an organizer/guest live test are approved.

## Questionari / Fragebögen — separate UI module

DNS Polls now has three distinct workflows in navigation:

- **Terminumfragen / Sondaggi date:** existing availability/date polls, unchanged
- **Fragebögen / Questionari:** general questionnaires with free text,
  single/multiple choice and yes/no answers; required questions; option
  editing and reordering; respondent preview
- **Veranstaltungen / Eventi:** events, supplemental questions and registrations

**Current Questionari status is a client-only UI prototype**, just like the
unauthenticated Events design workshop. The draft list, form and respondent
preview live strictly in React state. Switching between DNS Polls tabs keeps
these drafts and an unfinished editor in memory; reloading the page discards
drafts and test responses. Organizers can preview unsaved valid edits, return
to the editor without losing the work, and duplicate drafts with independent
question/option objects. No questionnaire data is written to Firestore, cookies,
localStorage, external APIs or the date-polls collection. The "Simula invio"
action only validates required fields and displays a local success message.
It is **not** a real submission, sharing, collection or reporting mechanism.

Next gated backend phase: define a separate questionnaire schema, DNS Core
permissions, organizer scope, retention/privacy, published response model,
server-side authorization and audit tests before enabling persistent
questionnaires. Do not reuse legacy anonymous date-poll writes.

## Events interface workshop (temporary)
Until the DNS Core SSO backend is deployed and tested, unauthenticated
organizers can open the **Events** tab without a Google login prompt.
This is a **local-only UI workshop**, not organizer access:

- The Events list and form are available for visual feedback in IT/DE.
- Creating an event writes only to React component state. No Firestore API,
  participant data, URL sharing, CSV or registrations are used.
- Closing the tab/refreshing the page discards all preview drafts. Nothing is
  published, stored in the browser or sent to Firebase.
- Already authorized organizers keep the existing secured Events workflow.
- If the Core SSO bridge is enabled but no Core user is signed in, the same
  local-only UI workshop appears; it must not provide a bypass to the API.
- This is separate from the future **Questionari** (general questionnaires)
  module. Existing date polls (Terminumfragen/Sondaggi date) remain unchanged.

The existing Firestore Rules are unchanged. A UI preview does **not** turn
registration or privileged event operations into anonymous endpoints.

## DNS Core → Polls SSO (staged, not yet live)
The backend for stage-1 event metadata operations has been prepared in
`dns-shared-data` PR #183, but **its Cloud Function is not deployed** and
the required cross-project Firebase IAM identity has not been configured.

The optional frontend adapter:
- reuses the same `dns-core` Firebase Auth app name as Workspace, allowing
  same-origin browser session persistence without a second login;
- sends the current Core ID token in an HTTPS Authorization header to an
  explicitly configured endpoint;
- asks the backend to enforce `events.read` or `events.manage` each time;
- never places credentials in URLs or iframe messages;
- displays no participant data and creates events initially closed.

`VITE_DNS_POLLS_BRIDGE_URL` **defaults to unset (off)**. While unset, the
previous Polls organizer flow stays unchanged. Set this variable **only after**
authorized backend deployment and manual end-to-end sign-in/permissions tests.
A configured URL must be the **canonical DNS Core Firebase Functions URL**,
for example `https://europe-west8-dns-core.cloudfunctions.net/pollsBridgeApi`.
The frontend rejects Cloud Run `a.run.app` URLs, non-DNS-Core projects,
unexpected paths, credentials, query parameters and redirects **before**
obtaining/transmitting a DNS Core ID token. Confirm the official
`cloudfunctions.net` URL from the deployed function; do not copy the
`serviceConfig.uri` Cloud Run URL into this variable. Unsetting and
redeploying rolls back to the old route.

## Launch flags
The GitHub Pages build uses these separately controlled settings:
- `VITE_DNS_EVENTS_ENABLED` — defaults to `true`, to show the organizer console.
- `VITE_DNS_EVENT_REGISTRATION_ENABLED` — defaults to `false`, to hide public invitation links and disable public event routes.
- `VITE_DNS_POLLS_BRIDGE_URL` — defaults to empty, so the Core-session adapter is dormant.

Values can be explicitly overridden in GitHub Actions repository variables.
Changing an Actions variable requires a fresh Pages deployment. No frontend flag is a substitute for Firestore rules.

## Go-live verification
1. Confirm organizer Google login in DNS Polls and ability to create an event.
2. Verify the organizer can list events and export only their own authorized registration data.
3. Publish an event-specific privacy notice (the general website notice covers a different digital-consent form).
4. Approve retention/deletion, anti-spam controls and complete anonymous registration tests.
5. Only then set `VITE_DNS_EVENT_REGISTRATION_ENABLED=true` and redeploy Pages.

Rollback public registrations with `VITE_DNS_EVENT_REGISTRATION_ENABLED=false`.
The canonical source remains Firestore project `dns-polls`; personal fields must not feed public Hub/Portal/Analytics views.
