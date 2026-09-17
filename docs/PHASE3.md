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

## PDF sharing

The owner preview now offers Prepare PDF after a separate review acknowledgment. It exports only the selected frozen content, without creating a bearer link. Download PDF saves a real multi-page A4 file; Share PDF invokes the device file-sharing menu on a direct user click. WhatsApp and other targets appear only when installed and supported. Unsupported browsers and cancelled sharing leave the download available.

The PDF is generated in browser memory with bundled licensed fonts; no health content goes to a PDF service or permanent browser storage. Leaving the preview releases its download URL. Exported files include source/capture dates, owner-maintained provenance, omission notices, page numbers, and a clear statement that copies do not expire or respond to link revocation. No raw record IDs, attachment URLs, or bearer tokens are included. Unsupported font characters cause an explicit error instead of silently altering medical text. The protected-link option preserves those original characters.

Verification: automated browser checks cover actual PDF download, multi-page parsing, review consent, no link creation, file-sharing payload, cancellation, unsupported-browser fallback, responsive layout and accessibility. PDF text extraction and page rendering verify selected content and excluded identity fields. Physical WhatsApp delivery still requires a real phone; no message is automatically sent.

## Care details, status and navigation (17 September 2026)

Pet profiles store Inhouse/Care stray plus a private normal location required for Care stray. Existing pets default to Inhouse. Care strays have a dedicated Home section without the three-card limit, including archived care strays; rehomed and deceased pets are excluded from Home. My pets has separate Archived, Rehomed and Deceased filters. Opening any retained profile still provides its Health record and Summary.

Status is a visible text button. Transfer to new owner records REHOMED only after confirmation and validation of another verified Petish account's email. It does not move custody, records or access to that account. Rehoming makes the public profile private and revokes existing health-summary links in the same transaction. Restoring an active status cannot revive those links. When the recipient has no Petish account, use Prepare PDF summary in the status dialog instead. The PDF remains a permanent copy. Actual account-to-account custody transfer remains a separate workflow.

Sign out is available in the account sidebar. PDF exports have a tinted, bordered main-title panel and colored section headings using embedded fonts. Normal locations stay outside public projections and the existing selected summary allowlist.
