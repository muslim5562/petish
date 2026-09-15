# Phase 2 — Pet health

Implemented 15 September 2026 in `C:\Projects\Petish\_Astra`.

## Try it

Open http://127.0.0.1:3000/app, choose Milo, then **Health record**. The Home page also links directly to each active pet's health dashboard.

- **Overview:** explicitly active medication/problem counts, allergy knowledge, entered vaccination due dates, overdue medication status-review prompts, recent history.
- **Timeline:** chronological entries grouped by month, unknown dates at the end, type/search filters, and a separate removed-record view.
- **Add health record:** visit, medication, vaccination, problem, allergy, procedure, document, or note. A visit needs a date and reason; other entries start with a name/description. Optional details remain unknown when absent.
- **Documents:** private photographs and downloadable PDFs, also accessible from the original entry.
- **Summary:** owner-maintained current medications/problems, allergies, emergency notes, vaccinations, recent visits, and major procedures. “Show on screen” enlarges the owner-only view; it creates no public link.

## Acceptance criteria and evidence

The implementation is accepted when the following automated checks pass alongside the original Phase 1 regression suite:

1. All eight entry types save through the browser and persist on reload. An undated medication remains undated with unknown status. Visit outcome can be added later.
2. Record corrections retain immutable previous snapshots, original author/time, and sequential versions. A stale save is rejected; removal hides the entry from normal views; restoration recovers it.
3. Linked records reference a current visit for the same pet. Cross-pet linking is rejected and timeline entries are not duplicated.
4. Unknown allergies differ from an explicit owner report of no known allergies. Adding or restoring an allergy resets a stale “no known” statement and preserves context revisions.
5. Reminders use explicit next-due dates only. Missing dates remain missing, medication status does not change automatically, and archived/memorial profiles suppress reminders.
6. Anonymous and other-owner requests cannot read private records, revisions, or files. Publishing the identity profile does not publish health information. Removed records/files deny new file requests immediately.
7. JPEG/PNG/WebP/PDF uploads validate actual contents. Images are re-encoded without EXIF; spoofed files and PDFs with interactive content are rejected. Concurrent uploads cannot exceed five files per entry. Each upload is at most 20 MB, images at most 40 megapixels, PDFs 1–200 pages, and the account's combined allowance is 150 MB.
8. The five principal health screens fit 360, 390, 768, and 1280-pixel viewports. Automated Axe checks cover overview, timeline, documents, summary, visit form, and summary-notes dialog. Summary supports enlarged text and on-screen presentation.

Evidence: `tests/health.test.ts`, `e2e/phase2.spec.ts`, `.local/qa/phase2-overview-desktop.png`, `.local/qa/phase2-timeline-mobile.png`, and the Playwright report. The original Phase 1 tests remain in place. Final command results are recorded in the delivery report.

## Architecture and privacy

`HealthRecord` is the common timeline entity, with typed detail tables and optional same-pet visit references. Notes/documents use common fields without empty detail tables. `HealthRevision` stores a snapshot after every record mutation. `PetHealthContext` holds emergency notes and explicit allergy knowledge with its own revision table. Attachment metadata is separate from private object storage.

Every read checks the pet's current custodian. Writes also check the request origin and use row locks; record edits use optimistic version checks. File limits and quotas are serialized with the account/pet locks shared by identity-photo uploads. Health payloads and downloads use private, no-store responses. PDF downloads are forced attachments with restrictive content headers. The validator rejects interactive forms/actions, embedded files, remote actions, JavaScript and encrypted PDFs. This is content validation, not a certified malware scanner; production file handling needs its own operational review.

The Phase 1 public projection stays an explicit identity-field allowlist. No Phase 3 share token, QR code, or public medical endpoint is implemented. Previously downloaded files cannot be remotely erased.

## Removal and retention

Removing a record is reversible and retains its files internally. Individually removed attachments lose access immediately and become eligible for permanent removal after 30 days. Run `npm run cleanup:health` as a maintenance job to purge those expired objects and attachment rows; revision snapshots retain historical filenames/metadata, never usable object links. This local demo does not install a recurring production scheduler. Removed files count toward storage until purged.

`npm run cleanup:uploads` skips every referenced identity or health object, including removed-but-retained attachments, and removes only abandoned local objects older than 24 hours. Preserve `.env` and `.local`. The pre-Phase-2 database snapshot is in ignored `.local/backups`; backups need a declared expiry before production use.

## Demo and generated asset

Seeding is idempotent and demo-only, preserves existing changes, and adds Milo's fictional visits, chronic issue, active medication, vaccination, allergy, procedure, note, report and packaging image. Demo clinical statements are explicitly fictional and provide no medicine or dosing recommendation.

Asset: `C:\Projects\Petish\_Astra\public\demo\fictional-medication.png`. Generated with the built-in imagegen tool; a private processed copy is attached to the demo medication record.

Generation prompt: “Use case: product-mockup. Asset type: fictional medication packaging photo attachment for the Petish demo pet health app. Create a square realistic close-up photograph of one plain amber bottle with a white cap on a neutral tabletop, soft daylight. Its simple cream paper label must read exactly: ‘FICTIONAL DEMO’ in large bold text, ‘Milo’ below, and ‘Not a real medicine’ below that. No actual medicine name, dosage, medical instructions, brand, clinic address or personal data. Label fully readable, bottle fully in frame. This is synthetic demonstration material.”

## Environment limits

Physical phone camera capture, real SMTP and remote S3 remain untested locally. Automated Chromium checks are not a full accessibility certification. Account deletion processing and backup expiry remain the launch prerequisites documented in Phase 1. This delivery is a local synthetic-data app, not a production deployment.

## Final validation — 15 September 2026

TypeScript, ESLint, all 9 rule/database tests, all 4 browser tests, production build and dependency audit passed. Audit: zero known vulnerabilities. Axe reported no violations on the six Phase 2 surfaces listed above. Desktop and mobile screenshots were visually reviewed. Temporary browser/database fixtures were removed after testing. Physical camera, remote S3 and real SMTP checks remain outstanding.

