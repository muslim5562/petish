export function hostedConfigProblems(env) {
  const problems = [];
  const required = [
    "DATABASE_URL",
    "BETTER_AUTH_URL",
    "BETTER_AUTH_SECRET",
    "MAIL_FROM",
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY",
    "S3_SECRET_KEY",
  ];
  for (const key of required)
    if (!env[key] || /CHANGE_ME|REPLACE_ME|GENERATE_/.test(env[key]))
      problems.push(`${key} must be configured.`);
  try {
    const url = new URL(env.BETTER_AUTH_URL);
    if (
      url.protocol !== "https:" ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      problems.push(
        "BETTER_AUTH_URL must be the public HTTPS origin without a path or credentials.",
      );
  } catch {
    problems.push("BETTER_AUTH_URL must be a valid HTTPS origin.");
  }
  try {
    const url = new URL(env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      problems.push("DATABASE_URL must use PostgreSQL.");
  } catch {
    problems.push("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if ((env.BETTER_AUTH_SECRET || "").length < 32)
    problems.push(
      "BETTER_AUTH_SECRET must contain at least 32 random characters.",
    );
  if (env.PETISH_DEMO !== "false")
    problems.push("PETISH_DEMO must be false on this hosted configuration.");
  if (!["smtp", "resend"].includes(env.MAIL_MODE))
    problems.push(
      "MAIL_MODE must be smtp or resend; local mail capture must not be hosted.",
    );
  if (env.MAIL_MODE === "smtp" && !env.SMTP_HOST)
    problems.push("SMTP_HOST must be configured.");
  if (
    env.MAIL_MODE === "resend" &&
    (!env.RESEND_API_KEY || /REPLACE_ME/.test(env.RESEND_API_KEY))
  )
    problems.push("RESEND_API_KEY must be configured.");
  if (env.PETISH_PHONE_PREVIEW === "true")
    problems.push("Shared phone-preview mode must be disabled.");
  if (env.STORAGE_DRIVER !== "s3")
    problems.push("STORAGE_DRIVER must be s3 for durable private uploads.");
  if (env.S3_ENDPOINT) {
    try {
      if (new URL(env.S3_ENDPOINT).protocol !== "https:")
        problems.push("S3_ENDPOINT must use HTTPS.");
    } catch {
      problems.push("S3_ENDPOINT must be a valid HTTPS URL.");
    }
  }
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    problems.push("PORT must be a valid TCP port.");
  return problems;
}
