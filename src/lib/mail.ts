import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
export async function sendMail(to: string, subject: string, url: string) {
  if (process.env.PETISH_PHONE_PREVIEW === "true")
    throw new Error("Email is disabled in the shared phone preview.");
  if (process.env.MAIL_MODE === "local" && process.env.PETISH_DEMO === "true") {
    const dir = path.join(process.cwd(), ".local", "mail");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify({ to, subject, url, createdAt: new Date().toISOString() }),
    );
    return;
  }
  if (process.env.MAIL_MODE === "resend") {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
      throw new Error("Email delivery is not configured");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject,
        text: `${subject}\n\n${url}\n\nIf you did not request this, ignore this email.`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error("Email delivery failed. Please try again.");
    return;
  }
  if (!process.env.SMTP_HOST)
    throw new Error("Email delivery is not configured");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text: `${subject}\n\n${url}\n\nIf you did not request this, ignore this email.`,
  });
}
