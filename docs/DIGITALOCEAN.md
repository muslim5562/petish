# Deploy Petish from GitHub to DigitalOcean

Prepared for `muslim5562/petish`, branch `main`, using the root Dockerfile. This preparation does not create paid resources or publish the local database.

## Proposed resources

- App Platform web service, Singapore, one `apps-s-1vcpu-1gb` container. Keep inactivity sleep/scale-to-zero disabled so Lost & Found maintenance runs.
- Managed PostgreSQL in the same region. Use a production managed cluster with backups, not the App Platform development database.
- Private Spaces bucket in Singapore for uploaded photos and PDFs. Use bucket-scoped read/write/delete credentials, no public listing or public object ACLs. Petish serves authorized images through its API; browser CORS is unnecessary.
- Resend HTTPS email API, already supported by Petish. Verify a sender domain you control, such as `ivirtual.com.my`, before using `Petish <muslim@ivirtual.com.my>`. Domain verification needs access to its DNS. The App Platform address does not verify an email sender domain.

The app container costs $12/month at the published September 2026 price; database, Spaces, email, taxes and overages are separate. Review the combined estimate in DigitalOcean before creating resources.

## GitHub connection and app settings

1. Sign in to DigitalOcean, choose App Platform → Create App, and authorize access to `muslim5562/petish` through GitHub.
2. Select `main`, source directory `/`, Dockerfile `Dockerfile`, web service, HTTP port `3000`. Keep the Dockerfile's startup command; do not replace it with `npm run local` or `npm start`.
3. Use `.do/app.yaml` as the app-spec template, or copy its settings into the creation wizard. This template references separately provisioned PostgreSQL/Spaces through environment variables; it does not create them. Replace every `REPLACE_ME` before deployment. Enable auto-deploy from `main` when ready.
4. Start with the supplied `*.ondigitalocean.app` HTTPS address. `BETTER_AUTH_URL=${APP_URL}` follows the primary app URL. No purchased domain is required for the website.
5. Set health check `/api/healthz`, initial delay 60 seconds. Startup applies committed migrations before serving requests. Docker builds use a dummy URL and do not connect to the live database.

## Runtime variables

Use the values in `.do/app.yaml`. Store database URLs, auth secret, storage credentials and email API key as encrypted runtime variables, never GitHub files or screenshots.

- `DATABASE_URL`: the managed database's connection string, with the correct database/user and TLS enabled. Add the app as a trusted source in the database's network settings.
- `DATABASE_CA_CERT`: for PostgreSQL Standard Edition, paste the downloaded CA certificate's complete PEM text. Hosted startup writes it to a temporary file and adds `sslmode=verify-full` and `sslrootcert` to the connection URL for both migrations and the web process. Literal `\n` escapes are also supported. For a provider using a system-trusted certificate, leave it empty and use `sslmode=verify-full` in the URL. Do not disable certificate verification.
- `BETTER_AUTH_SECRET`: generate a unique random value of at least 32 characters. For example, run `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` privately and paste the result into DigitalOcean.
- `S3_ENDPOINT=https://sgp1.digitaloceanspaces.com`, `S3_REGION=sgp1`; set the actual bucket name and its access/secret keys. Use the regional endpoint, not the bucket/CDN URL.
- `MAIL_MODE=resend`, `RESEND_API_KEY`, `MAIL_FROM`: verified sending identity and HTTPS API credentials.
- `PETISH_DEMO=false`, `PETISH_PHONE_PREVIEW=false`, `STORAGE_DRIVER=s3`. Never enable local demo mode on this deployment.
- `LOST_FOUND_MODERATOR_EMAILS`: trusted operator email(s). The template uses the previously provided `muslim@ivirtual.com.my`; register and verify that Petish account to use moderation.

## Data and launch verification

GitHub contains application code, not local PostgreSQL data or `.local/objects`. A fresh cloud database therefore starts empty. Aisha, Farid, sample pets, bulletin entries and health histories remain local. If those records are wanted online, arrange a separate reviewed database/object migration; do not enable demo mode or copy local passwords into a public demo.

Before calling the site live, verify: successful migration and health check; account registration and verification email; password reset; private photo upload and retrieval; pet/health data after redeploy; PDF generation; a guest found report and verification email; a private response notification; case closure blocking public photos; moderator access; phone camera/upload over HTTPS. Real DigitalOcean database/storage/email connectivity remains untested until resources are configured.

## References

- [GitHub deployment quickstart](https://docs.digitalocean.com/products/app-platform/getting-started/quickstart/)
- [App spec reference](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [Persistent storage](https://docs.digitalocean.com/products/app-platform/how-to/store-data/)
- [App pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/)
- [PostgreSQL TLS and trusted sources](https://docs.digitalocean.com/products/databases/postgresql/how-to/secure/)
- [Spaces SDK compatibility](https://docs.digitalocean.com/products/spaces/reference/aws-sdks/)
