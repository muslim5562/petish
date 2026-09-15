# Phase 3 — controlled health-summary sharing

## Owner workflow

Open a pet → Health → Summary → Share selected summary. Choose fields, sections and individual entries, then review the exact frozen snapshot. Owner name and microchip are off by default. Documents, attachments and links to the live record are always excluded. Free-text fields can be excluded; titles remain, so review them for personal information too.

Choose 1 hour, 24 hours (default), 7 days, or explicitly opt into Until revoked. Confirm that anyone holding the link can view and forward it. Copy the resulting link, display its QR code, or use the device share sheet where available. Clipboard failure leaves a selectable link. Show on screen displays the reviewed snapshot.

The link and QR are shown only when created. They cannot be recovered from stored hashes; copy the link before leaving. Shared links lists the latest 200 entries with their status and original snapshot. Revoke one link or all links. Expired or revoked links cannot be extended or revived; create a new snapshot and link.

## Snapshot and access policy

- The server freezes selected content before owner confirmation. Later record edits never change it. A preview can be issued for 15 minutes; link expiry starts at issuance.
- The snapshot uses an explicit content allowlist, preserving source labels, date precision, unknown values and owner-maintained provenance. Omission is never a statement that a condition is absent.
- Limits: 30 allergies/current medications/active problems per section, 6 vaccinations, 3 visits and 5 major procedures. Exclusions are applied before limits; shortened sections are labelled.
- Database triggers prohibit snapshot changes, link token/expiry changes and reversal of revocation. Current-owner authorization protects all management operations.
- A 256-bit random token is delivered in the URL fragment. Only its SHA-256 hash is stored. The browser posts it to a fixed endpoint; it never appears in HTTP paths or query strings. Do not enable request-body logging in hosting infrastructure.
- Every recipient API request checks expiry, revocation and current custody. Responses use no-store, no-referrer and no-index headers. No analytics or third-party recipient assets are loaded. The service worker caches only the generic offline page.
- Open recipient pages revalidate every 30 seconds and when returning to the foreground. They clear on expiry, offline state or failed validation. Revocation denies subsequent requests immediately; an already displayed or saved copy cannot be recalled.
- Ownership changes revoke all existing pet links within the database transaction. A rolled-back transfer does not revoke them. Returning ownership does not resurrect revoked links. Transfer UI remains Phase 6.
- Limits: 100 previews per pet per day and 50 active links per pet. Run `npm run cleanup:shares` periodically to remove unissued drafts whose expiry passed more than 24 hours ago; issued history is retained.

## Acceptance checks

Automated integration and browser coverage verifies conservative defaults, explicit no-expiry consent, selected exclusions, immutable snapshots after live edits, hash-only storage, expiry boundaries, owner isolation, one-time issuance, expired drafts, revocation, custody-change rollback/commit, anonymous read-only access, clipboard fallback, QR rendering, responsive layouts and accessibility. The full Phase 1–3 regression suite must pass before delivery.

Actual iOS/Android camera scanning and native share-sheet behavior require physical-device testing. The temporary phone site is a shared fictional demo, depends on this computer and tunnel staying online, and is not permanent hosting. Permanent deployment still requires hosted database/storage/email and operational setup.
