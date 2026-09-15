import { test } from "node:test";
import assert from "node:assert/strict";
import { sendMail } from "../src/lib/mail";
import { hostedConfigProblems } from "../scripts/hosted-config.mjs";
test("HTTPS email sends expected payload and hides provider errors", async () => {
  const saved = { ...process.env };
  const original = globalThis.fetch;
  try {
    process.env.MAIL_MODE = "resend";
    process.env.PETISH_PHONE_PREVIEW = "false";
    process.env.RESEND_API_KEY = "test-only";
    process.env.MAIL_FROM = "Petish <test@example.test>";
    globalThis.fetch = async (input, options) => {
      assert.equal(input, "https://api.resend.com/emails");
      const body = JSON.parse(String(options?.body));
      assert.deepEqual(body.to, ["recipient@example.test"]);
      assert.ok(body.text.includes("https://example.test/verify"));
      return new Response("{}", { status: 200 });
    };
    await sendMail(
      "recipient@example.test",
      "Verify",
      "https://example.test/verify",
    );
    globalThis.fetch = async () =>
      new Response("private provider response", { status: 403 });
    await assert.rejects(
      sendMail(
        "recipient@example.test",
        "Verify",
        "https://example.test/verify",
      ),
      /^Error: Email delivery failed\. Please try again\.$/,
    );
    delete process.env.RESEND_API_KEY;
    await assert.rejects(
      sendMail(
        "recipient@example.test",
        "Verify",
        "https://example.test/verify",
      ),
      /not configured/,
    );
    assert.ok(
      hostedConfigProblems({ MAIL_MODE: "resend" }).some((p) =>
        p.includes("RESEND_API_KEY"),
      ),
    );
    assert.ok(
      hostedConfigProblems({ PETISH_PHONE_PREVIEW: "true" }).some((p) =>
        p.includes("phone-preview"),
      ),
    );
  } finally {
    globalThis.fetch = original;
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
