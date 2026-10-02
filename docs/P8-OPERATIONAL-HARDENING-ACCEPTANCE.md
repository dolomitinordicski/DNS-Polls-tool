# DNS Polls — P.8 Operational hardening & acceptance

Date: 2026-10-01

## Goal

Close DNS Polls with operational hardening now that Firestore live access,
legacy-poll recovery and automatic Firestore Rules deployment are working.

P.8 focuses on:

- GDPR-complete deletion;
- private-contact deduplication;
- safer destructive Firestore rules;
- private-sync error diagnostics;
- a final acceptance checklist.

## P.8A — GDPR-complete deletion

Deleting a poll is now an administrative operation.

The app asks for the private DNS admin session only when a destructive delete
is requested. Polls itself remains usable without authentication.

A successful delete removes, in the same Firestore batch for normal poll sizes:

- the poll document;
- all public `responses`;
- all protected `privateContacts`;
- initial invitee-list records;
- participant e-mail records.

After the cloud delete succeeds, the browser-local recipient entry for that poll
is removed from `dns_polls_poll_recipients_v1`.

The repository refuses to delete a Firestore poll unless the current Firebase
Auth user is the authorized DNS account. This prevents the previous state where
the public poll could disappear while protected e-mail records remained behind.

## P.8B — Private-contact hygiene

New participant contacts use one canonical document ID:

`participant-<responseId>`

This means editing the same response no longer creates a new private-contact
document on every save.

When the authorized organizer opens private recipient sync for an older poll,
historical participant-contact duplicates are compacted automatically:

- records are grouped by participant ID;
- the newest `updatedAt` value wins;
- the latest value is written to the canonical participant-contact ID;
- obsolete duplicate records are deleted.

Initial invitees remain separate through `invitee-*` IDs.

## P.8C — Rules hardening

The temporary operational mode is retained for non-destructive management:

- poll read: public;
- poll create/update: temporarily open;
- response create/update: public and validated.

Destructive operations are hardened:

- poll delete: DNS admin only;
- response delete: DNS admin only;
- private-contact read/delete: DNS admin only.

Public private-contact creation is allowed only when:

- the document ID is the canonical `participant-<responseId>`;
- the data passes the private-contact validator;
- the corresponding public response exists after the batched write.

Public private-contact updates may refresh only the same canonical participant
record and may not change the stored participant identity or e-mail address.
Admin updates remain unrestricted within the validator boundary.

## P.8D — Private sync diagnostics

Private Google sign-in now surfaces actionable configuration errors for:

- Google provider disabled in Firebase Authentication;
- `dolomitinordicski.github.io` missing from authorized domains.

Authentication remains optional for normal Polls use and is requested only for
private-data sync or destructive GDPR-complete deletion.

## Acceptance checklist

### Public / invitee path

1. Open a poll link in a signed-out/incognito browser.
2. Confirm the poll loads without organizer authentication.
3. Submit first name, last name, e-mail and one vote for every slot.
4. Confirm the organizer view receives the response live.
5. Edit the same participant response and verify no duplicate public response is
   created.

### Organizer / private sync

1. In Create Poll, add a recipient list under section 04.
2. Use **Private cloud sync** and sign in with
   `management@dolomitinordicski.com`.
3. Open the same poll in a second authorized browser.
4. Confirm the recipient list is restored from protected Firestore.
5. Change the list and confirm Share and Finalization display the same values.

### Finalization / ICS

1. Finalize one slot.
2. For an online meeting, save a conference URL.
3. Download the Outlook ICS.
4. Confirm:
   - selected date/time;
   - Europe/Rome timezone;
   - organizer;
   - location or conference URL;
   - current recipient list.

### GDPR delete

1. Delete a disposable test poll.
2. If signed out, confirm the app asks for DNS admin sign-in.
3. Confirm the poll disappears from the live dashboard.
4. In Firestore verify that the deleted poll no longer has:
   - `responses`;
   - `privateContacts`.
5. Reopen Share/Finalization for other polls and confirm their recipient lists
   remain unaffected.

## Remaining production decision

P.8 deliberately does **not** require admin authentication for poll creation or
ordinary poll edits because DNS Polls is still in the agreed temporary open
operational mode.

The final production-auth decision can later restrict poll create/update to the
DNS admin account without changing the invitee response flow.

## Rollback

Pre-P.8 branch:

`backup/pre-p8-hardening-2026-10-01`


## F9 privacy cleanup

The final Foundation freeze removes the obsolete automatic vote-notification
integration that posted participant names and availability to Formsubmit.
Participant responses now remain within the Polls Firestore/local-cache
boundaries defined above. Sharing by e-mail/WhatsApp remains an explicit
organizer action, and QR codes are generated locally in the browser.
