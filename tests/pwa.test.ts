import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { hostedConfigProblems } from "../scripts/hosted-config.mjs";
test("hosted configuration refuses exposed local-demo settings and incomplete persistence", () => {
  const valid = {
    DATABASE_URL: "postgresql://user:pass@db.example.test:5432/petish",
    BETTER_AUTH_URL: "https://petish.example.test",
    BETTER_AUTH_SECRET: "a".repeat(40),
    SMTP_HOST: "smtp.example.test",
    MAIL_FROM: "Petish <hello@example.test>",
    S3_BUCKET: "private-petish",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "key",
    S3_SECRET_KEY: "secret",
    PETISH_DEMO: "false",
    MAIL_MODE: "smtp",
    STORAGE_DRIVER: "s3",
  };
  assert.deepEqual(hostedConfigProblems(valid), []);
  assert.ok(
    hostedConfigProblems({
      ...valid,
      PETISH_DEMO: "true",
      MAIL_MODE: "local",
      STORAGE_DRIVER: "local",
    }).length >= 3,
  );
  assert.ok(
    hostedConfigProblems({
      ...valid,
      BETTER_AUTH_URL: "http://192.168.1.2:3000",
    }).length,
  );
});
test("service worker bypasses APIs, files and writes; cached fallback contains no private data", async () => {
  const listeners: Record<string, (event: unknown) => void> = {};
  const scope = {
    addEventListener: (name: string, handler: (event: unknown) => void) => {
      listeners[name] = handler;
    },
    location: { origin: "https://petish.example.test" },
  };
  vm.runInNewContext(await readFile("public/sw.js", "utf8"), {
    self: scope,
    URL,
  });
  for (const [url, method, mode] of [
    ["/api/health/secret", "GET", "cors"],
    ["/api/images/secret", "GET", "cors"],
    ["/api/health/secret", "POST", "cors"],
    ["https://elsewhere.test", "GET", "navigate"],
  ]) {
    let intercepted = false;
    listeners.fetch({
      request: {
        url: new URL(url, scope.location.origin).toString(),
        method,
        mode,
      },
      respondWith: () => {
        intercepted = true;
      },
    });
    assert.equal(intercepted, false);
  }
  const html = await readFile("public/offline.html", "utf8");
  assert.ok(html.includes("Unsaved changes are not queued"));
  assert.equal(html.includes("<script"), false);
});
