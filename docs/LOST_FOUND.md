# Lost & Found

## Use it

- Public board: `/lost-found`. No account required to browse or reply.
- Petish sidebar: **Lost & Found**. Open a pet profile and choose **Report missing** for an Inhouse or Care stray pet. Rehomed and deceased pets cannot be reported missing.
- A missing report uses a reviewed public snapshot and one or two selected/uploaded photos. It does not change profile visibility. Normal location, microchip and health records are not copied.
- Guests can post a found pet with one or two photos. A private email is required; a public phone number is optional. The report stays private until its email management link is explicitly confirmed.
- Public visitors submit private sightings or ownership claims, with up to two photos and an optional phone. Email verification is required before the manager can see them. A verified signed-in account can submit immediately using its own email.
- **My reports** contains notifications, open reports, and closed history. Guests can request fresh management links by email. Management links last 30 days; response-verification and reunion invitations last seven days.
- Closing removes the report and its photos/contact information from public endpoints. Private history remains. Old public URLs show an unavailable message. Content previously downloaded or shared outside Petish cannot be recalled.
- A found-report manager can select a verified claimant when closing as reunited. The emailed invitation lets that person sign in/register with the same email, review the details, and create a private pet profile or link one they already own. Existing profile fields are not overwritten. Finder photos are copied only with both finder permission and claimant consent, and only into an empty gallery. No ownership transfer is performed.

## Notifications and inactivity

Verified responses create durable in-app notifications and email notifications. Failed notification emails are retried up to five attempts. Verification and invitation emails show a failure message and can be resent by the user; these bearer links are not kept in plain text in the database.

The continuously running Next.js server runs maintenance after startup and every 30 minutes. A PostgreSQL advisory lock prevents simultaneous scheduled runs across server replicas. Maintenance queues a reminder after 30 days without reconfirmation, archives after 60 days, retries notifications, and clears expired access tokens and rate buckets. Public reads independently enforce the 60-day cutoff even if maintenance is delayed. This scheduler requires the web service to remain running; use an always-on Railway service. During downtime, it catches up on startup. An operator can also run `npm.cmd run maintain:board` in the source checkout.

Closed/archived history and private evidence are retained; this release does not automatically delete case history or unverified drafts. Reopening a case requires a current eligible pet and no other active missing case. Moderator-hidden reports cannot be reopened by the poster.

## Email and moderation configuration

Local demo: `MAIL_MODE=local` captures messages at `/local-mail`; no external emails are sent. Use separate signed-in and incognito windows to test owner and guest flows.

Hosted deployment: configure the existing SMTP or Resend email adapter and private S3 storage. Real SMTP delivery and the hosted environment require a separate live deployment check. The temporary shared phone preview intentionally disables guest email verification.

Set `LOST_FOUND_MODERATOR_EMAILS` to a comma-separated list of trusted, verified Petish account emails, then restart the server. Those users see **Moderation** at `/lost-found/moderate`. Everyone else is denied by the API. The queue supports reviewing reported concerns, hiding reports, restoring hidden reports, and dismissing concerns. Moderation actions are audited. An empty setting grants no moderator access; configure an operator before public launch.

## Data boundaries

- Public endpoints use an explicit field allowlist; card listings omit phone numbers. Detail pages show phone numbers only after the poster's explicit consent.
- Response details, email addresses and response photos are restricted to the report manager. Reunion invitations do not grant access to other people's private responses.
- Opaque tokens are 256-bit random values stored only as SHA-256 hashes. Email URLs place them in the fragment; clients send them in POST bodies, never image URLs. Do not configure hosting logs to capture request bodies or email contents.
- All board API responses/photos are `no-store`; pages are marked `noindex` and use `no-referrer`. The service worker does not cache board records or images.
- Uploaded JPEG/PNG/WebP images are decoded, resized and re-encoded, stripping embedded metadata. Maximum two photos per report/response, 10 MB each, with a 24 MB streaming request limit.
- Mutations enforce same-origin requests. Persistent hourly limits apply to email identities and the whole board; honeypot fields reject simple form bots. This is not a substitute for operator moderation. Add stronger bot challenges and capacity monitoring if public traffic warrants it.
- Location is entered as a locality/landmark. There is no automatic GPS capture, image matching, ownership decision, reward payment, or public comment thread.

## Checks

`npm.cmd test` includes local integration coverage for guest verification, public projections, private-photo authorization, closure/reopening, expiry, email notification durability, and claim-to-profile import. `npx.cmd playwright test e2e/board.spec.ts` exercises public and owner screens, local email links, phone layout, and accessibility. Tests use exact temporary fixtures and captured email; they must not run against a production database.
