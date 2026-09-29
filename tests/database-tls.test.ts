import { test } from "node:test";
import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";
import { readFile, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import { prepareDatabaseTls } from "../scripts/database-tls.mjs";
test("database CA is shared by migrations and runtime with full verification", async () => {
  const env = {
    DATABASE_URL:
      "postgresql://sample:sample@db.example.test:25060/defaultdb?sslmode=require",
    DATABASE_CA_CERT: rootCertificates[0].replaceAll("\n", "\\n"),
  };
  const file = await prepareDatabaseTls(env);
  assert.ok(file);
  try {
    const url = new URL(env.DATABASE_URL);
    assert.equal(url.searchParams.get("sslmode"), "verify-full");
    assert.equal(url.searchParams.get("sslrootcert"), file);
    assert.equal(
      (await readFile(file, "utf8")).trim(),
      rootCertificates[0].trim(),
    );
    assert.equal(url.hostname, "db.example.test");
  } finally {
    await unlink(file);
    await rmdir(path.dirname(file));
  }
});
test("database TLS setup preserves existing URLs without a custom CA and rejects invalid CA input", async () => {
  const env = {
    DATABASE_URL:
      "postgresql://sample:sample@db.example.test/defaultdb?sslmode=verify-full",
  };
  const original = env.DATABASE_URL;
  assert.equal(await prepareDatabaseTls(env), null);
  assert.equal(env.DATABASE_URL, original);
  await assert.rejects(
    prepareDatabaseTls({ ...env, DATABASE_CA_CERT: "not a certificate" }),
    /PEM CA certificate/,
  );
});
