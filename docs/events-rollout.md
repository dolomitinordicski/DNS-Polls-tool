# DNS Polls — verified activation stages

## Current state
- DNS Foundation v1.3.0 and Events/Forms code are merged.
- The existing `firebase-rules.yml` workflow successfully deployed the Event rules to **dns-polls** on 2026-10-28 (GitHub Actions run 40685534139).
- **Stage A:** organizer Events dashboard is enabled on GitHub Pages, behind the existing DNS Google login.
- **Stage B:** public registration is off until a specific event-registration privacy notice, retention handling, abuse protection and an organizer/guest live test are approved.

## Launch flags
The GitHub Pages build uses two independent flags:
- `VITE_DNS_EVENTS_ENABLED` — defaults to `true`, to show the organizer console.
- `VITE_DNS_EVENT_REGISTRATION_ENABLED` — defaults to `false`, to hide public invitation links and disable public event routes.

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
