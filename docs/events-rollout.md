# DNS Polls — verified activation stages

## Current state
- DNS Foundation v1.3.0 and Events/Forms code are merged.
- The existing `firebase-rules.yml` workflow successfully deployed the Event rules to **dns-polls** on 2026-10-28 (GitHub Actions run 40685534139).
- **Stage A:** organizer Events dashboard is enabled on GitHub Pages, behind the existing DNS Google login.
- **Stage B:** public registration is off until a specific event-registration privacy notice, retention handling, abuse protection and an organizer/guest live test are approved.

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
A configured URL must be the reviewed HTTPS bridge endpoint, never a user
supplied URL. Unsetting and redeploying rolls back to the old route.

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
