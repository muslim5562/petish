# Petish

A mobile-first home for cats, dogs, and the people who care for them. This repository implements **Phases 1–3** of `revised prompt.md`.

## Open the local app

Visit **http://127.0.0.1:3000/login** and choose **Explore the demo**. The demo signs in as Sarah, who cares for Milo, Coco, and Oreo, with Sunny in memories. All profiles and people are fictional.

This is a local development installation, not a public deployment. The application and PostgreSQL bind to loopback only. No external account, paid service, or hosting resource is required for the demo.

## Start after a restart

Use Node.js 24 LTS and a terminal in `C:\Projects\Petish\_Astra`:

```powershell
npm ci
npm run local
```

The local launcher preserves `.env`, starts the project database if necessary, generates the Prisma client, applies migrations, adds any missing demo records, and starts the app. It will not overwrite existing pet changes. Keep the terminal running. Press Ctrl+C to stop the app. The locally started PostgreSQL child is stopped when this launcher exits normally.

On npm versions that block dependency installation scripts, approve the explicitly listed scripts in package.json and run `npm rebuild`. The platform-specific PostgreSQL package needs its symlink hydration script. Never approve arbitrary dependency scripts without reviewing them.

### Separate terminals

For manual development:

```powershell
npm run setup
npm run db:start
```

In a second terminal:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run setup` creates random local credentials and secrets only if `.env` is absent. They are never committed. Additional fictional owner credentials are in `.local/demo-accounts.json`. Sam's account starts with no pets.

## Email verification and recovery

Use the registration and forgot-password forms normally. Open **http://127.0.0.1:3000/local-mail** to follow the captured verification or reset link. No email is sent in local mode. The mailbox is intentionally visible to anyone using this loopback demo; use synthetic addresses only.

The demo helper and mailbox API require `PETISH_DEMO=true` and a loopback hostname. For a real deployment, set `PETISH_DEMO=false`, configure SMTP, and use an HTTPS `BETTER_AUTH_URL`. Better Auth handles password hashing, verification, recovery, sessions, logout, CSRF protections on its own endpoints, and authentication rate limiting. Sessions are read from the database rather than a stale cookie cache.

## Implemented

- Landing, registration, verification, sign-in, recovery, and sign-out.
- Owner Home, My Pets, species filters, search, profile settings, and account deletion requests with password confirmation.
- Create/edit pets with stable UUIDs, unknown demographic values, birth-date precision, private microchips, and optional details.
- Up to three photos per pet, direct camera capture where supported, library selection, main-photo selection, replacement, removal, and retry messaging.
- Server-side image validation, metadata removal, WebP conversion, thumbnails, a 150 MB account allowance, and private file delivery.
- Public-profile preview and explicit publication, strict public-field allowlist, link copying, and immediate denial of future anonymous page/photo requests after making private.
- Archive, restore, and private memorial profiles.
- Five synthetic owners, twelve seeded pets, three public profiles, and attributed licensed photography.

Phase 2 adds a private health dashboard, chronological timeline, eight short entry forms, corrections and edit history, linked visits, private photos/PDFs, an owner-only summary, and entered-date reminders. Milo has fictional history from 2021 onward, including a synthetic medication photo and report. Phase 3 adds owner-reviewed immutable health snapshots, expiring bearer links, QR codes, and individual or bulk revocation. See docs/PHASE3.md. Appointments, adoption, and transfer UI remain future phases.

## Stack and storage

Next.js 16, React 19, TypeScript, Better Auth, Prisma 7, PostgreSQL 18, Sharp, Zod, Lucide, Nodemailer, and the AWS S3 SDK. Fonts are bundled locally.

The local database is a real PostgreSQL process installed through `embedded-postgres`, not an in-memory substitute. It persists in `.local/postgres` on port 55432. The upstream embedded distribution is beta-tagged; use an independently managed PostgreSQL service for production.

Images and health PDFs are stored outside the relational database under `.local/objects` for the local demo. The same storage interface supports private S3-compatible storage when `STORAGE_DRIVER=s3`. Configure the S3 settings in `.env.example`. S3 objects must remain private; all owner and public requests pass through the application's authorization endpoint. Remote S3 and real SMTP were not provisioned or integration-tested in this local build.

Raw uploads are not retained. Re-encoded, metadata-free detailed WebP images and square thumbnails are retained. The generic licensed files in `public/demo` illustrate the synthetic app and are not user uploads. Photo credits and adaptation licences appear in `/credits` and `public/demo/ATTRIBUTION.md`.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm audit
```

The database and local server must be running for integration/browser tests. Browser setup: `npx playwright install chromium`.

`tests/` covers required fields, invalid dates, unknown information, public projection, private custody, persisted edits, image validation, concurrent photo limits, and memorial visibility. `e2e/` exercises owner workflows, public revocation, isolation between accounts, session invalidation, email verification, recovery, and responsive views. Screenshots are in `.local/qa`, and the Playwright report is in `playwright-report`.

See `docs/ACCEPTANCE.md` for the checked scope and remaining manual checks. Browser emulation does not verify a physical phone camera or mobile keyboard. No claim of complete accessibility certification is made.

## Data lifecycle and launch boundaries

Deletion requests are recorded and can be cancelled with password confirmation. The demo does **not** execute permanent deletion. A production launch requires an operator process, approved retention and backup policies, account/pet resolution, and the proposed 30-day recovery workflow. Do not accept real records until that processing is ready.

`scripts/cleanup-uploads.ts` removes only unreferenced image/PDF objects older than 24 hours from local demo storage. Remote S3 requires a reviewed equivalent lifecycle job before launch. Referenced files are never selected by the cleanup routine.

Preserve `.env` and `.local` when updating code. They contain the local database, private images, secrets, and mail capture. Back them up together if the demo data matters. Do not commit them or expose the local mailbox to a network.

The dependency overrides for `deepmerge-ts` and `mysql2` select patched releases required by the dependency audit. Prisma generation, migrations, tests, and production compilation are verified with these overrides. Reassess them when upgrading Prisma; do not run a blind major-version audit fix.

## Source map

- `src/app` — routes, authenticated shell, public page, API handlers, and theme.
- `src/components` — mobile owner experience, short pet forms, photo management, login, and public projection presentation.
- `src/lib` — authentication, authorization, validation, custody-aware operations, email, and storage.
- `prisma` — schema, migrations with database integrity constraints, and idempotent demo seed.
- `scripts` — configuration, database startup, local launcher, and orphan cleanup.
- `docs/ARCHITECTURE.md` — implemented architecture and extension boundaries.
- `revised prompt.md` — governing specification copied from the reviewed document.

Phase 2 is implemented. See `docs/PHASE2.md` for acceptance evidence, privacy rules, file retention, and remaining manual checks. Phase 3 is controlled sharing and requires a separate request.

## Install on a phone

The PWA and a temporary HTTPS phone preview are now implemented. Open /install for Android and iPhone instructions. See docs/PWA.md for the current preview address, restart steps, privacy/cache behaviour, verification results and permanent-hosting preparation. No domain or hosting account is required for the temporary preview. Use sample data only in the shared preview.



## Lost & Found bulletin board

Open /lost-found, or choose Lost & Found from the Petish sidebar. Report a missing pet from its profile, post found pets without an account, verify private sightings by email, close cases into private history, and invite a reunited owner to add a pet profile. See [Lost & Found operation and testing](docs/LOST_FOUND.md) for email, moderation, inactivity, and privacy details.

## Additional sample accounts

Run `npx tsx scripts/seed-sample-accounts.ts` in the local installation to add Aisha Rahman (3 pets), Farid Hassan (10 pets), and fictional Lost & Found cases. Use normal email/password sign-in; credentials are saved only in the ignored `.local/sample-accounts.txt` file. Re-running preserves existing sample records and passwords without adding duplicates. This script refuses nonlocal databases and never sends email. Sample records are local database content, not part of GitHub deployment.
