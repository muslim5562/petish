# Petish — installable app and phone preview

Completed 15 September 2026 in `C:\Projects\Petish\_Astra`.

## Open on your phone

Current temporary preview: https://trio-comparisons-medline-derby.trycloudflare.com/install

Open that address in Safari on iPhone/iPad or Chrome on Android. The page explains how to add Petish to your home screen. Choose **Open Petish → Explore the demo**, then Milo → Health record → Add health record → Medication → Take photo. No hosting account, domain, or USB setup is needed for this temporary test.

This is a **shared synthetic demo**. Anyone using its demo sign-in can see that demo account. Use sample images and notes only. The database and uploads are separate from the original local app. The link works while this PC, local PostgreSQL, and the preview process remain running. Restarting the tunnel creates a new address; remove the old home-screen installation and install from the new address if necessary.

## Delivered

- A valid web app manifest with stable app ID, standalone display, branded launch colours, 192/512-pixel icons, a maskable icon, and an Apple touch icon. Icons reuse the existing Petish mark; no new image-generation service was used.
- An installation page linked from the landing page, sign-in screen, and owner footer. Native install button appears when the browser supplies an installation event; Safari has explicit manual steps.
- Generic offline navigation fallback and an in-app connection-loss notice. Failed writes are not queued or replayed. Unsaved form values remain in memory while the current form remains open, but are not stored across a reload or close.
- A service worker with one deliberately limited cache entry: `/offline.html`. No pet pages, API responses, health records, photos, PDFs, or authentication data enter Cache Storage. Normal authorized file/page responses remain private and no-store.
- Build-stamped service-worker releases. An available update waits for user action, with a reminder to save work before reloading.
- A production-mode HTTPS phone preview through an official Cloudflare Quick Tunnel, without a hosting account.
- A Dockerfile, staging environment template, and hosted startup validation for a future persistent deployment. No paid service or account was created.

## Verification

- TypeScript, ESLint and production build: pass.
- Rule/database tests: **11 pass**.
- Browser tests: **5 pass**, including all previous Phase 1/2 workflows.
- Dependency audit: **0 known vulnerabilities**.
- Install guide: Axe reports no violations; responsive checks at 360, 390, 768 and 1280 pixels pass. Installation, offline, and HTTPS mobile screenshots were visually reviewed.
- Actual HTTPS preview: secure context, valid manifest, **zero Chromium installability errors**, demo sign-in, authenticated uploads/downloads, unauthorized file denial, disabled signup/mail routes, and the single generic cache entry all verified.
- Offline test: a failed save retains the draft in the open form, full navigation shows only the generic fallback, and reconnecting does not silently create an entry.

Evidence: `tests/pwa.test.ts`, `e2e/pwa.spec.ts`, `scripts/check-preview.mjs`, `.local/qa/pwa-https-check.json`, and `.local/qa/pwa-*.png`.

Physical Android/iPhone home-screen installation, OS launch appearance, real camera capture, permission prompts, orientation, and mobile keyboard behaviour require the user's phone. Desktop browser checks do not claim to cover those. No push notifications or offline record editing were added. Phase 3 controlled health sharing is now implemented; see PHASE3.md.

## Preview operation

The current preview runs on loopback port 3002 behind HTTPS. The existing app stays on port 3000.

The launcher `npm run preview:phone` uses a dedicated `petish_phone_preview` PostgreSQL database and `.local/phone-preview/objects`. Its independently generated credentials and auth secret are in ignored `.local/phone-preview/secrets.json`. Current URL/process metadata is in `.local/phone-preview/preview.json`. No original `.env` values are overwritten, and no original local database or upload files are copied into the preview.

Registration, password recovery/account auth changes, and local-mail access are disabled in explicit phone-preview mode. The normal local app retains its original account features. Demo sign-in still creates a normal authenticated session. The permanent hosted configuration refuses demo/local-mail/local-upload mode.

To restart after stopping the preview:

1. In the project folder, run `npm run local` to keep the original app and PostgreSQL available.
2. In another terminal, run `npm run build`, then `npm run preview:phone`.
3. Use the new HTTPS address printed by the launcher. Keep the PC awake. Ctrl+C in the preview terminal stops the preview server and tunnel.

The portable `.local/tools/cloudflared.exe` was downloaded from the official Cloudflare GitHub release, version 2026.9.1, and checked against its published SHA-256 digest. Source URL and hash are recorded in `.local/tools/cloudflared-source.json`. It is not installed as a Windows service or added globally to PATH.

## Persistent hosting, later

A stable app address requires a hosting account; a purchased domain is optional because providers supply HTTPS subdomains. The prepared container needs PostgreSQL, private S3-compatible storage, and working SMTP. Configure `.env.staging.example` values in the provider's secret settings, with a new auth secret and a separate staging database/bucket. Do not upload the local `.env` or `.local` directory.

`scripts/start-hosted.mjs` checks settings without printing secrets, applies migrations, then serves Next.js on the provider's port. The Docker build excludes local secrets/data and uses only non-secret placeholders during compilation. Runtime credentials must be supplied separately.

Docker is not installed on this PC, so the container recipe is prepared but not container-build tested. Real SMTP and remote S3 remain untested. Production account deletion processing, backup expiry, storage-retention jobs and operational monitoring remain the previously documented launch work; this phone preview is not a production launch.

## Reference documentation

- Apple home-screen installation: https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios
- Chrome installability guidance: https://web.dev/articles/install-criteria
- Cloudflare Quick Tunnels: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
- Framework implementation followed the installed Next.js PWA guide in `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`.

