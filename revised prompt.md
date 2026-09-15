# Petish revised product and development prompt

## 1 Purpose and authority

Design Petish, a mobile-first web application for cat and dog owners. Combine a welcoming pet companion experience with a reliable longitudinal health record. The pet keeps its identity and history throughout its life, including when its owner or veterinary clinic changes.

The current owner is the custodian of the record. This is a product and data-model principle, not a claim about legal ownership of data or an animal.

This document replaces the earlier Petish prompt. Requirements using “must” are mandatory. Examples illustrate intent rather than requiring exact wording or layout. Items explicitly marked deferred must not enter the current phase without approval.

### Approval gate

Do not create an application, install dependencies, scaffold a repository, provision services, run migrations, deploy, or implement any phase until the user explicitly authorizes building. Reading this prompt or requesting its analysis is not authorization to build.

When asked for planning, produce only the requested plans and stop. When authorized to build Phase 1, implement only Phase 1 and stop after verification and reporting. Subsequent phases each require explicit authorization. An instruction to build Phase 1 does not authorize public production deployment or spending money on services.

### Working decisions

The decisions below resolve the earlier prompt's ambiguities and are the defaults for this specification. They are proposed product choices, not statements that the user separately approved each choice. Highlight a material conflict before implementation; do not silently substitute a different behavior.

## 2 Product principles

- Make the experience warm, modern, personal, and trustworthy. Use pet photography, readable text, generous spacing, rounded cards, and friendly prompts without excessive animation or childish styling.
- Design for a phone first: one-handed use, short interactions, camera capture, showing information to a vet, and sharing through the device share sheet. Adapt this design for tablets and desktops.
- Ask only for information useful at that moment. Optional details can be added later. Avoid dense medical tables and long registration forms.
- Keep pet identity, current custodianship, profile visibility, adoption state, and health-record access separate.
- Enforce permissions on the server and storage layer. Hiding controls is not an access-control mechanism.
- Store owner-entered information faithfully. Do not present it as veterinarian-verified or infer a diagnosis or healthy status from missing data.

## 3 Resolved scope and technical defaults

The complete MVP comprises six phases. Phase 1 is the first reviewable release, not a claim that the full MVP is complete. The architecture must accommodate later phases without implementing their user interfaces early.

Use a TypeScript web application, Next.js, Prisma, PostgreSQL, and private S3-compatible object storage as the planning baseline. Use a maintained authentication library or managed authentication service; do not create a custom password or session system. Select compatible supported versions and the specific authentication and storage providers during authorized technical planning, based on the available environment. Do not assume a paid provider or choose a production hosting region without approval.

Use email-based accounts with email verification, sign-in, sign-out, and account recovery. The authentication method may be a provider-supported password or email-link flow; document the choice before implementation. Require reauthentication for sensitive account operations and completed-transfer authorization. Mobile numbers are optional contact details, not login or transfer identifiers in the MVP.

Transactional email is an MVP dependency for verification, recovery, and transfer invitations. This resolves the previous conflict that deferred all email while requiring invitations. Push notifications, SMS, and marketing email remain deferred. In local development, a mail-capture service may replace delivery; clearly label that limitation and never claim an email reached a recipient when it did not.

Store event timestamps in UTC and display them in the user's context. Treat birthdays and health-event dates as calendar dates. Clinics have explicit time zones; booking slots are displayed with the clinic's time zone. Start with English and locale-aware date presentation. Do not assume a launch country from sample content or workspace settings.

## 4 Owner accounts and pet identity

An account can care for multiple pets. Each pet has one current custodian in the MVP and one permanent internal UUID. Shared custody, clinic ownership of records, and duplicate-record merging are deferred.

Initial registration requires only a pet name and species, limited to cat or dog. Show a short form with sex, age, and main photo, but allow “Unknown” or “Skip for now.” A failed or unavailable camera must not prevent pet registration. Encourage a photo without requiring one.

Optional attributes include breed, mixed-breed indicator, sex including unknown, exact or approximate birth date, colour, markings, microchip number, neutered or spayed status including unknown, general area, and a short description. Do not treat a microchip as the primary key or as proof of identity. Avoid publicly exposing it.

Store birth-date precision explicitly: exact date, approximate date or year, or unknown. Convert an entered approximate age into a reference date with its precision and original entry context; do not store a number that becomes stale. Display approximate ages as approximate. Never invent a birthday from an estimate.

Support up to three primary identity photos. One is the main photo; optional view labels are front, left, right, or unspecified. Do not require a front-view photograph to register. Replacement and removal are supported. A general social photo gallery is deferred; health attachments do not count toward the three-photo limit.

Maintain ownership history from the initial registration. The current-owner reference and active ownership record must agree transactionally. Do not assign existing records to a different pet when custodianship changes.

## 5 Navigation and Phase 1 experience

The owner home shows a greeting, a prominent My Pets area, Add Pet, and genuinely available recent activity. Each pet card shows the main image or an attractive placeholder, name, species or breed, approximate age when known, and clear visibility status.

Pet profiles show identity first, with edit and photo actions. Health, sharing, booking, and adoption actions appear only when their phase is implemented. Do not show invented appointments, health indicators, or nonfunctional primary buttons in Phase 1.

Phase 1 bottom navigation contains Home, My Pets, and Profile. Expand it to Home, My Pets, Vets, Adopt, and Profile as those features become functional. Use labelled icons, persistent active state, and safe spacing around device insets.

Use friendly empty states such as “Let's add your first pet” and “Add a photo of Milo.” Preserve entered data after recoverable errors. Provide visible loading, saving, success, and failure states, accessible labels, keyboard navigation, and usable focus behavior.

## 6 Public profiles and adoption visibility

All new pets are private. Profile visibility is PRIVATE or PUBLIC. Adoption state is separately NOT_LISTED, LOOKING_FOR_HOME, ADOPTION_PENDING, or ADOPTED. Public pages and adoption pages use separate explicit allowlists of fields.

A public pet page may include an approved photo, name, species, breed, sex, approximate age, general area, and description. It must exclude health records, documents, microchip number, exact birth date, owner identity and contact information, internal audit data, and precise location. Use an opaque public page identifier; an identifier never substitutes for authorization.

Before publication, show the exact public projection for confirmation. The owner may return it to private at any time. New requests to the page and its images must then be denied, including through caches controlled by the application. Explain that already downloaded content cannot be recalled.

An adoption listing can be public while the normal pet profile is private. Publishing adoption is a separate explicit action. Switching the normal profile to private does not silently remove an adoption listing; offer “Make all pet pages private” to hide both. Display visibility and adoption status distinctly.

Adoption disclosures may include temperament, household suitability, indoor or outdoor preference, optional rehoming reason, and owner-approved general health, vaccination, and neutering information. Health disclosures are independently selected; never copy the full medical record into a listing. Unpublishing a listing removes it from discovery and public access.

## 7 Health records and provenance

Phase 2 adds a lightweight health dashboard, timeline, encounters, medical problems, medications, vaccinations, allergies, procedures, notes, and attachments. Use Add Health Record choices to open a short relevant form. Provide explicit entry paths for allergies and procedures even if they are grouped under “More.”

A vet visit requires a date and reason or short note. Clinic, what the vet said, treatment, advice, attachments, and outcome are optional. An outcome may be added later. Never require an owner to enter a recovery outcome at the appointment itself.

A medication requires a name or owner description and a date or explicitly unknown date. Instructions, indication, start and end dates, notes, and photographs are optional. Preserve instructions as entered without dose calculations or automatic drug identification.

Each health item records pet UUID, author, entered timestamp, source type, optional source clinic, occurrence date with precision, and last modification timestamp. Source types are Owner Entered, Copied From Vet Record by Owner, and Imported Document. Reserve a future Veterinarian Verified state but do not let owners select it.

Link treatments, medications, procedures, and attachments to their encounter when relevant. Use one underlying item referenced from different views instead of duplicating data. Show the timeline newest first, distinguish occurrence date from entry date, and show undated records in a clearly labelled group.

Owners can correct entries. Keep audit metadata and revision history for meaningful edits and removals. Removed items disappear from normal views; retention and eventual deletion follow the documented data lifecycle. Do not claim a hidden entry was permanently deleted. New owners may annotate or correct transferred information while preserving its original provenance.

### Health status and reminders

Missing information means Unknown or Not recorded. “No allergies recorded” is distinct from an explicit owner statement that no allergies are known. A friendly message must not imply medical clearance or clinical verification.

Medication status is explicitly active, completed, stopped, or unknown. A past end date may trigger a review prompt; it does not silently assert completion. Problems have explicit active, resolved, or unknown state.

Vaccinations store the recorded administration and an optional owner-entered or document-supplied next due date. Derive due reminders only from that entered date. Do not infer a vaccination schedule from species or claim “Up to date” from absent records. Use “No recorded doses currently due” only when applicable, and show missing due dates separately.

## 8 Health summary sharing

Provide a concise owner-only live summary for showing on screen. It includes selected identity, important allergies, active medications and problems, recent major encounters, vaccination records and due dates, major procedures, emergency notes, provenance, and last-updated information. Clearly distinguish unknown from absent conditions.

Creating a share link produces an immutable snapshot of the selected summary. Show its creation time and explain that later record edits are not included. The owner previews the snapshot and can exclude fields. Owner name and microchip are off by default; detailed documents and attachment links are excluded in this MVP.

Use a cryptographically random bearer token with at least 128 bits of entropy and store only its hash. Offer expiry choices of 1 hour, 24 hours, and 7 days, with 24 hours selected by default. Allow “Until revoked” only through an explicit additional choice. Explain that anyone possessing the link can view it and recipients can forward or copy it.

Support Show on Screen, create link, copy link, QR code, and native sharing where available. Provide a copy-link fallback. A recipient needs no account. Opening a share link grants no access to the underlying record or edit functions.

Check expiry and revocation on every request. Avoid caching sensitive responses, search indexing, token logging, third-party analytics, and referrer leakage. A QR code must contain the same protected URL, not raw health data. The owner can list and revoke shares. Revocation prevents future access but cannot erase a recipient's screenshots or saved copies.

Revoke all prior health-summary links when a transfer completes. Do not grant a new owner control over a former owner's active bearer links.

## 9 Veterinary directory and appointments

Phase 4 introduces clinic discovery by name and area, clinic profiles, telephone, directions, sharing, services, optional professional listings, opening hours, and bookable slots. Distinguish opening hours from appointment availability. No veterinary access to health records is introduced.

An application operator maintains verified directory content. A restricted clinic booking coordinator manages its clinic's slots and requests through a minimal operational interface. This role sees only booking information and owner-approved contact details, never the health timeline, shared-summary contents, or attachments. Clinics without a coordinator or maintained slots offer Call and Directions rather than pretending to accept bookings.

Bookings are requests until confirmed. The owner selects pet, clinic, slot, and reason; previously stored pet details are reused. Default slot capacity is one. Requested and confirmed bookings reserve capacity. Reserve capacity atomically at the database level so simultaneous requests cannot double book.

States are REQUESTED, CONFIRMED, COMPLETED, CANCELLED, DECLINED, and EXPIRED. Rescheduling is an audited transition to a new reserved slot, not a terminal status. Release the old slot only when the replacement succeeds. Owners may cancel future bookings; coordinators confirm, decline, complete, and propose or perform agreed rescheduling.

Unconfirmed requests expire at the earlier of 24 hours after request or the appointment start time, with notification and capacity release. Clearly label a request as unconfirmed. In-app notifications cover confirmation, cancellation, changes, and reminders. Demonstration bookings must be labelled synthetic and must not contact real clinics.

## 10 Adoption and enquiries

Phase 5 adds public adoption discovery with species, area, age, and sex filters. Unknown ages and sexes remain representable. Listings have shareable URLs and public-safe preview metadata.

Require a verified account to send an enquiry. Capture name, message, and an explicitly chosen reply contact. Deliver it to the listing owner's inbox. Support one enquiry thread with replies, read status, closing, blocking, and reporting; this is a narrow listing conversation, not a social network.

Owner contact details remain hidden unless the owner deliberately chooses to disclose them. Apply submission rate limits and provide an operator workflow for reported listings or enquiries. Do not expose precise home locations by default.

ADOPTION_PENDING pauses new enquiries and removes the listing from discovery. ADOPTED closes the listing and makes it inaccessible publicly. Listing status never transfers custodianship by itself; only the transfer acceptance transaction does that.

## 11 Ownership transfer and privacy

Phase 6 permits one pending transfer per pet. The current owner reauthenticates, enters the recipient's email, reviews the transfer contents and consequences, and creates a single-use invitation that expires in seven days. Email the invitation; the verified recipient account must match the invited email. Reject self-transfer and replay attempts. The sender may cancel before acceptance.

Before initiating, show all documents and free-text records for privacy review. Pet clinical facts and history remain associated with the pet. Previous-owner account details, contact information, billing information, enquiries, appointment contact details, and audit identities are not disclosed to the new owner.

Attachments are excluded from recipient access by default until the sender explicitly marks each original or redacted copy transferable. Preserve the pet-history entry and note when an attachment is unavailable. Do not claim automatic redaction is reliable. Free text must also be reviewed because it may contain personal information. Describe this boundary clearly: the same pet history persists, but private former-owner material is not automatically handed over.

Acceptance must atomically close the old ownership period, create the new one, update current custody, record the audit event, revoke prior shares, close any adoption listing, and reset the normal pet profile to private. Preserve the pet UUID, clinical items, provenance, and approved attachments. Pending or cancelled invitations must not change access or custody.

After acceptance, the previous owner has no normal read, edit, download, or image access to the pet. A minimal transfer receipt may remain in account activity without exposing the health record. A later shared summary grants read-only snapshot access; it does not restore custody or editing rights.

Block completion while future appointments remain active; require cancellation first, then let the new owner rebook. This avoids silently transferring contact information or appointment obligations. Pending transfers expire or cancel cleanly and can be reissued.

An incorrect completed transfer is handled through a reviewed support process or a new reverse transfer accepted by the current custodian. Never silently rewrite ownership history or permit unilateral rollback by the former owner.

## 12 Storage and data model

Use UUIDs, foreign keys, consistent timestamps, and database constraints. Proposed entities include User, OwnerProfile, Pet, PetOwnership, PetTransferInvitation, PetImage, Encounter, MedicalProblem, Medication, Vaccination, Allergy, Procedure, HealthNote, Attachment, HealthSummarySnapshot, HealthSummaryShare, VeterinaryClinic, Veterinarian, ClinicBookingMembership, AppointmentSlot, Appointment, AdoptionListing, AdoptionEnquiry, EnquiryMessage, Notification, and AuditLog.

Store profile visibility on Pet unless a separate entity has a demonstrated purpose. AdoptionListing owns adoption state. Use attachment relationships for medication images rather than duplicating file metadata unnecessarily. Keep snapshot content separate from its access token records. Implement only Phase 1 entities and justified foundations in Phase 1; provide a conceptual model for later phases.

Keep original files and derivatives outside the relational database. Store object keys, pet association, uploader provenance, category, media type, byte size, timestamps, transferability, and access classification in the database. Uploader identity does not determine ongoing permission after transfer.

Identity photos accept JPEG, PNG, and WebP up to 10 MB each before processing. Health uploads later accept those image formats and PDF up to 20 MB per file, with up to five attachments per health entry initially. Reject other types with a clear message. HEIC conversion is optional and must not be advertised unless tested; otherwise explain supported formats.

Validate actual file contents and dimensions, prevent unsafe active content, strip image location metadata, generate thumbnails, and retain a suitable detailed image. Use private storage and authorized delivery; public photos use an application-controlled endpoint that checks current visibility. Do not leave permanent public object URLs accessible after privacy changes. Enforce storage quotas and clean up abandoned uploads without deleting referenced objects.

## 13 Account and record lifecycle

Support account recovery and session invalidation. Archiving a pet removes it from the default My Pets view while retaining its history and access for the custodian. A deceased state records the owner's entry, hides public and adoption pages, and stops future health reminders without deleting history.

Provide an account deletion request route in Phase 1. Document the processing policy before accepting real production data. Former-owner accounts must not erase records now held by another custodian. For a current custodian, resolve transfer or deletion of their remaining pets explicitly. Do not promise permanent deletion while retaining accessible copies.

For planning, use a 30-day recovery window for requested deletion of exclusively held account and pet data, followed by removal from active storage; backup expiry must be documented before production launch. Retain only necessary, access-restricted audit metadata under a declared retention policy. Production retention periods and jurisdiction-specific obligations require a launch review; they are not obstacles to a synthetic-data Phase 1 demo.

## 14 Phase plan and screen hierarchy

### Phase 1 Pet experience

Build authentication, account recovery, owner Home, My Pets, Add Pet, Pet Profile, Edit Pet, Pet Photos, Visibility Settings with public preview, Public Pet Profile, Profile and account settings, archive and deceased controls, and an account deletion request route. A concise public landing page leads to sign-in or registration. Photo and visibility settings may be sheets or sections rather than separate routes.

### Phase 2 Pet health

Add health dashboard, timeline, quick entry and editing, visits, medications and photos, vaccinations, problems, allergies, procedures, documents, notes, concise owner summary, and reminders based on entered dates.

### Phase 3 Controlled sharing

Add snapshot preview, secure share creation, QR code, device share integration, fallback copying, shared browser page, expiry, revocation, and Shared Links management.

### Phase 4 Vets and booking

Add directory, clinic profile, availability, booking request, My Appointments, notifications, and the minimum operator and clinic booking interfaces required for the workflow.

### Phase 5 Adoption

Add listing creation and preview, discovery, adoption profile, enquiries and replies, reports, moderation, and sharing.

### Phase 6 Transfer

Add privacy review, invitations, pending transfers, acceptance, cancellation, expiry, transfer receipts, ownership audit, and end-to-end continuity verification.

### Deferred throughout the MVP

Do not implement veterinary clinical documentation or direct medical-record access, clinic-to-owner synchronization, insurance, payments, telemedicine, AI diagnosis, automatic drug recognition, laboratory integration, social networking, complex clinical coding, shared custody, or automated duplicate-pet merging.

## 15 Demonstration data

Keep demonstration data isolated and clearly labelled. Never use real personal or medical records as seeds. Use owned, licensed, or generated pet images without exposed location metadata. Seeding must be repeatable and restricted to development or demo environments.

Phase 1 includes five synthetic owners and twelve cats and dogs, including mixed breeds, unknown demographic values, one owner with no pets, one owner with several pets, at least three public pets, at least three private pets, an archived pet, and a deceased pet. Include Milo as a memorable main demonstration pet. Do not seed future workflows as if implemented.

As later phases arrive, add three synthetic clinics, several years of Milo's health history, one chronic problem, an active medication and photo, vaccinations, a report, appointments, three adoption listings, enquiries, and pending and completed transfers. Demonstrate the same pet UUID and history across a completed transfer.

## 16 Phase 1 acceptance criteria

Phase 1 is complete only when all applicable checks below pass. Record the evidence and any environment limitation; do not mark an untested capability as passed.

### A Accounts and isolation

- A new user can register, verify their email through the configured delivery or labelled local capture path, sign in, sign out, and recover access.
- Unauthenticated requests to owner pages and private APIs are denied. After logout, prior sessions cannot continue accessing protected data.
- With two independent owner accounts, each sees only their own pets. Direct requests using another owner's pet or image identifiers cannot read or change private records.
- Loading and error states do not leak private data or reveal whether an inaccessible private pet exists.

### B Registration and pet management

- A user can register a cat or dog with only a name and species; missing sex, age, and photo remain explicitly unknown or absent.
- An owner can add multiple pets, edit optional fields, and reload the application without losing persisted changes.
- Each pet has a stable UUID and an initial ownership record. Editing name or microchip does not change identity.
- Exact and approximate age inputs retain their precision. Invalid or future birth dates receive clear validation; unknown dates do not create fake birthdays.
- Archiving and restoring work. Deceased status is visibly distinct and removes the pet from public display.

### C Photographs

- Taking a photo is tested on an actual mobile browser where available; choosing an existing image remains available as a fallback. If actual-device testing is unavailable, report it as outstanding.
- A user can add, choose a main photo, replace, and remove identity photos. A fourth photo is rejected by both the interface and server.
- Invalid formats and files over 10 MB are rejected clearly. Upload failures preserve the pet form and permit retry.
- Valid images produce readable thumbnails and detailed views. Location metadata is removed from served derivatives and retained originals.
- Direct image access respects custody and current public visibility. Guessing an object key or changing a request identifier does not expose another owner's private photo.

### D Public privacy

- Every newly created pet is private. Its public route and image route are inaccessible until publication.
- Publication requires a public preview and explicit confirmation. The page contains only the approved public fields.
- Public page HTML, API responses, metadata, previews, and image URLs do not disclose owner contact information, microchip, exact birth date, or private fields.
- Returning a pet to private blocks subsequent anonymous page and image requests through application-controlled caches. Already downloaded copies are not falsely described as recalled.
- Updating approved public content updates the public projection without exposing other stored attributes.

### E Mobile and accessibility

- At widths of 360, 390, 768, and 1280 CSS pixels, primary journeys have no unintended horizontal scrolling, clipped controls, or overlapping navigation.
- Primary touch targets are at least 44 by 44 CSS pixels. Forms have visible labels and useful error text, and focus remains visible during keyboard navigation.
- At 200 percent text zoom, registration, editing, and privacy settings remain usable. Text and controls meet WCAG AA contrast targets.
- Bottom navigation has labels and an active state. Save controls remain reachable when the mobile keyboard is open.
- Empty, loading, success, and error states are implemented. There are no enabled controls for unavailable later-phase features.

### F Data and delivery quality

- The Phase 1 seed dataset meets Section 15 and is repeatable without accidental duplication or production execution.
- Migrations create the implemented entities and constraints. Authorization is centralized enough to support future custody transfer without relying on uploader identity.
- Type checking, linting, and a production build succeed. Meaningful automated tests cover cross-owner access, public-field allowlisting, private image access, photo limits, and persistence.
- End-to-end verification covers register or sign in, add pet, upload photo, edit, publish, inspect anonymously, return to private, and confirm access denial.
- No credentials are committed. Configuration, local startup, database setup, storage setup, and demo access are documented.
- The completion report names implemented features, screens, entities, changed files, checks and results, known limitations, and the next proposed phase. Stop after reporting; do not automatically begin Phase 2.

## 17 Acceptance checks for later phases

Health entry creates one traceable underlying item, preserves edits and provenance, accepts unknown information, and presents recorded facts without unsupported clinical assertions.

Shared summaries require a valid token. Expired and revoked tokens fail. Snapshots do not change when live records change. Excluded fields remain absent from all responses.

Concurrent booking attempts cannot reserve the same capacity. Requested bookings are not labelled confirmed. Cancellation, expiry, and rescheduling release capacity correctly. Booking coordinators cannot access health records.

Adoption publication exposes only selected fields. Unpublishing and closing remove public access. Enquiries and replies are visible only to the relevant participants and authorized moderation roles.

Transfer acceptance requires the matching verified recipient, a valid unexpired invitation, and current authorization. Cancellation, expiry, duplicate acceptance, and simultaneous transfers fail safely. Acceptance preserves pet identity and clinical history, enforces attachment privacy, removes prior-owner access, revokes shares, and records the ownership transition atomically.

## 18 Required planning response before any authorized build

When the user requests architecture or implementation planning, provide the mobile screen hierarchy and navigation, proposed stack and providers, Phase 1 Prisma schema, conceptual future entities, ownership and transfer invariants, public-field projections, snapshot security model, upload approach, adoption privacy rules, and a phased implementation plan.

Identify every required form field and justify why it is necessary. Highlight unnecessary data entry. State unresolved environment dependencies honestly, separating local-demo limitations from production-launch requirements.

Finish with the exact scope proposed for approval. Do not proceed from a plan into implementation unless the user's instruction explicitly authorizes that build.
