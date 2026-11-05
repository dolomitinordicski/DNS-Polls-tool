# DNS-Polls — central Firestore rules release preparation

Status: **preparation only**. This isolated PR does not make changes to Shared Data, main, Firebase, credentials or any existing deployment workflow. The existing `.github/workflows/firebase-rules.yml` and the separate PR #66 are deliberately unchanged.

## Release source contract
- Source repository: `dolomitinordicski/DNS-Polls-tool`
- Source ref: immutable full Git commit SHA, verified to belong to the reviewed and protected `main` history.
- Firebase target project: **dns-polls**, not dns-core.
- Deployment resource: **firestore:rules** only.
- Contract: `release/central-rules-contract.json`
- Files: `firestore.rules`, `firebase.json`, `.firebaserc`, `firebase.emulator.json`
- Source preflight: `node scripts/verify-central-rules-release.mjs` plus the existing Firestore emulator rules tests in `.github/workflows/test-event-rules.yml`.

## Later implementation in dns-shared-data (for WORK)
1. Define a workflow dispatched from Shared Data `main` and scoped to an appropriate approved environment. Do not assume another repository can inherit Shared Data environment protection.
2. Accept only a reviewed immutable SHA from Polls protected `main`; prevent caller-controlled repository URLs, arbitrary command execution, alternate project IDs and untrusted PR head refs.
3. In a **credential-free job**, checkout that exact commit and run the offline preflight and Firestore emulator rules tests. Never pass production credentials or a GitHub token with write scopes to repository code.
4. In a separate deployment job, use an account with minimum permissions for Firebase Firestore rules deployment in **dns-polls**. Reverify the source SHA, manifest and target before applying **only firestore:rules**. Never deploy dns-core Firestore rules or Functions from this path.
5. Record approved SHA, source PR, approver, target project, deployed rules hash and workflow run outcome. Test the resulting authorization behavior with controlled test identities without writing production customer data.
6. Keep the existing local deploy path and credentials until central deploy and verification succeed. Then retire it via a separately approved PR. Remove repository secrets and any old keys only after proving there are no remaining consumers.

## Security constraints
- A Shared Data ruleset does **not** protect the Polls source repository. Its main branch needs independent review protection (or an equivalent explicit trusted-release check by the central controller).
- Existing `firebase-rules.yml` has a push-to-main deploy and FIREBASE_TOKEN fallback until a separate authorized migration/retirement. PR #66 addresses the fallback but is not merged and is not changed here.
- `deploy.yml` handles GitHub Pages and remains separate from central Firestore rules deployments.
- Polls SSO Bridge already has a separate deployment path in Shared Data; do not conflate it with deployment of dns-polls rules.
- The central controller must not run unreviewed code while privileged production credentials are available.

## Acceptance / outstanding work
- [x] Target, rule source and deployment target pinned in the contract.
- [x] Offline preflight is read-only and requires no credentials.
- [x] Current deploy workflows and Shared Data unchanged.
- [ ] New PR CI green.
- [ ] Full source ref and review validation in the eventual central controller.
- [ ] Emulator rules regression suite and staged deployment verification.
- [ ] Local credential path disabled only after successful central rollout.

**No merge, deploy or configuration mutation is authorized by this document.**
