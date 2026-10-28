# DNS Polls — controlled Events launch

Events and Forms remain **disabled by default**. Existing date polls are unaffected.
The canonical database is Firebase **dns-polls**, not dns-core.

## 1 · One-time credential (authorized project administrator)

Create a Google Cloud service account with the minimum permission needed to
publish Firestore security rules **only in dns-polls**. Store its JSON credential
as an encrypted GitHub Actions repository secret:
`FIREBASE_SERVICE_ACCOUNT_DNS_POLLS`. Never commit a credential or use a personal login.

## 2 · Deploy and verify security rules

After merging the release-workflow PR:

1. Open GitHub **Actions → Deploy DNS Polls Firestore rules (manual)**.
2. Select branch **main**, click **Run workflow**, and type `dns-polls`.
3. The workflow executes Firebase Emulator security tests **before** deployment.
4. Confirm the final `Deploy rules only to dns-polls` step succeeds.

The existing date-poll rules are preserved. This workflow never changes DNS Core,
deletes Firestore records or deploys Hosting.

## 3 · Launch only after real-user checks

Before enabling Events, verify DNS organizer login, event creation, an anonymous
registration, organizer-only CSV access, and anonymous read denial. Review the
privacy notice, data retention and abuse/duplicate-submission controls; emulator
tests alone do not prove these operational requirements.

When approved, set the GitHub Actions repository variable
`VITE_DNS_EVENTS_ENABLED=true`, then deploy GitHub Pages from `main`.
Check the live site with a test event and **non-personal test data**.

Rollback: set the variable to `false` and redeploy Pages. This hides Events
but does **not** remove stored registrations or change database permissions.

## 4 · Ecosystem data

Original event and registration data remain in dns-polls. DNS Hub, Partner Portal,
and Analytics will receive only authorized event summaries or aggregates through
versioned Data Contracts; never public participant names or email addresses.
