# DNS Polls — Events rollout

Events and Forms are **off by default**. Existing date polls remain available.

## Verified before production

- GitHub Actions TypeScript and Vite build: green.
- Firestore Emulator security tests: green, including guest writes and admin-only reads.
- Review privacy notice, registration data retention, duplicate/spam handling and real organizer authentication before public launch.

## Publish new Firestore rules

After merging the Events PR, an authorized Firebase operator deploys **only** the reviewed rules to the existing `dns-polls` project:

```sh
npx firebase-tools@14.12.0 deploy --only firestore:rules --project dns-polls
```

This must be run from the repository root on the reviewed `main` commit. Do **not** deploy to `dns-core`. Public registrants must never receive read access to `events/{id}/registrations`.

## Enable events when ready

In GitHub repository **Settings → Secrets and variables → Actions → Variables**,
create `VITE_DNS_EVENTS_ENABLED` with value `true`. Re-run the GitHub Pages deploy from `main`.

Verify: admin login, event creation, public invitation link, one registration, admin CSV export, denial of guest registration list access. Roll back by setting the variable to `false` and redeploying.

## Data ownership

The source of truth remains Firestore in the `dns-polls` project. DNS Hub, Partner Portal and Analytics will later consume permissioned public summaries or aggregates — **not** raw emails and free-text answers.
