# Phase 1 architecture

## Product surface

Public routes are `/`, `/login`, `/credits`, and `/p/:publicId`. The public pet page receives only an allowlisted projection. Local demo installations also expose a captured mailbox at `/local-mail`.

Authenticated routes are `/app`, `/app/pets`, `/app/pets/new`, `/app/pets/:id`, `/app/pets/:id/edit`, and `/app/profile`. Photo, visibility, and lifecycle operations use labelled native modal dialogs. Mobile navigation has Home, My Pets, and Profile. Future navigation is not rendered as inactive promises.

Only pet name and species are required. Sex, birth information, photo, and all optional profile details can be left unknown. Further fields are progressively disclosed. Exact birthdays and microchips never enter the public projection.

## Request boundaries

Authenticated page rendering checks Better Auth sessions. API handlers independently require a verified session. Owner reads and writes use both pet UUID and current owner UUID. Mutations validate same-origin requests; authentication routes use Better Auth's protections. Normal private failures do not distinguish an absent pet from an inaccessible one.

Images have no public bucket URL. Owner image requests require current custody; public image requests require an active, public pet and must identify its current main photo. Responses use `private, no-store` and `Vary: Cookie`. Public pet routes are dynamic, unindexed, and uncached. Changing visibility or lifecycle therefore affects subsequent requests to pages and images. No server can recall downloaded copies.

## Data model

User, Session, Account, and Verification are Better Auth tables. Owner profile fields currently live on User rather than creating a one-to-one table with no separate responsibility.

Pet holds immutable identity, a separate public identifier, current owner, profile fields, visibility, lifecycle status, birth precision, and selected main image. PetOwnership records the active ownership interval. PetImage stores object references, attribution to the uploader, view label, size, and type. AuditLog records who performed a meaningful mutation and when. DeletionRequest records account closure requests.

PostgreSQL constraints enforce at most one active ownership interval, agreement between current owner and active history at commit, and a main photo belonging to the pet. Pet creation and initial ownership happen in one transaction. Future transfers must update custody/history, private material access, shares, and listing state atomically. Uploader identity is provenance, never the rule deciding current access.

Photo transactions lock the account for quota enforcement and then the pet for the three-photo limit. They validate decoded formats, disallow animated files, cap input pixels at 40 million and input size at 10 MB, and retain only recompressed metadata-free WebP derivatives. Upload failures remove new objects; replacement and deletion remove superseded objects after committing references. A maintenance task covers old local orphan objects left by crashes.

## Local adapters and production configuration

The local PostgreSQL server persists under `.local/postgres`. A randomly generated credential is stored in ignored `.env`. Private disk storage and local captured email are explicitly demo-only adapters. Production is expected to use managed PostgreSQL, private S3-compatible storage, real transactional SMTP, HTTPS, backups, and retention operations. This build does not provision those services.

Email/password authentication is implemented through Better Auth, with required email verification and recovery links. The local Explore demo button calls Better Auth's normal sign-in API for a seeded account; it does not bypass sessions or create a custom authentication system. It is unavailable outside the explicit loopback demo configuration.

## Health and future entities

Phase 2 implements HealthRecord, Encounter, MedicalProblem, Medication, Vaccination, Allergy, Procedure, Attachment, HealthRevision, PetHealthContext and HealthContextRevision. Notes and documents use the shared HealthRecord fields. All records belong to a stable pet UUID and preserve author/source, occurrence-date precision and correction history. See PHASE2.md for the implemented access, quota, retention and summary rules.

Phase 3 implements HealthSummarySnapshot and HealthSummaryShare. Owner-selected snapshots are immutable at the database layer. Only SHA-256 hashes of 256-bit bearer tokens are stored. Recipient access checks expiry, revocation and custody on every request without underlying record access. A custody-change trigger revokes all pet links atomically. See PHASE3.md for selection, lifetime, privacy and maintenance policies.

Phase 4 introduces VeterinaryClinic, Veterinarian, ClinicBookingMembership, AppointmentSlot, Appointment, and Notification. Booking roles must not gain clinical permissions. Slot reservation and rescheduling require database-level concurrency handling.

Phase 5 introduces AdoptionListing, AdoptionEnquiry, EnquiryMessage, and moderation records. Profile visibility and listing state remain distinct. Selected adoption health disclosures are explicitly approved and independent of the full health record.

Phase 6 introduces PetTransferInvitation and the full acceptance transaction. Invitation matching, expiry, cancellation, former-owner material review, share revocation, and old-owner access removal are mandatory. Current custody is already the access boundary; the interface and transfer-specific policies remain deferred.

## Technical references

- Better Auth email and recovery configuration: https://better-auth.com/docs/concepts/email
- Better Auth configuration options: https://better-auth.com/docs/reference/options
- Prisma driver adapter guidance: https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7
- Embedded PostgreSQL distribution and local runtime: https://github.com/leinelissen/embedded-postgres

Installed Next.js guides in `node_modules/next/dist/docs` and package types are the authority for this pinned framework version.

