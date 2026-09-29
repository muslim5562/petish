import { X509Certificate } from "node:crypto";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Both Prisma migrations and the Node PostgreSQL driver read this CA file.
export async function prepareDatabaseTls(env) {
  if (!env.DATABASE_CA_CERT?.trim()) return null;
  const pem = env.DATABASE_CA_CERT.replaceAll("\\n", "\n").trim() + "\n";
  try {
    new X509Certificate(pem);
  } catch {
    throw new Error(
      "DATABASE_CA_CERT must contain the database provider's PEM CA certificate.",
    );
  }
  const url = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must use PostgreSQL.");
  const directory = await mkdtemp(path.join(tmpdir(), "petish-db-ca-"));
  const file = path.join(directory, "ca.pem");
  await writeFile(file, pem, { mode: 0o600 });
  url.searchParams.set("sslmode", "verify-full");
  url.searchParams.set("sslrootcert", file);
  env.DATABASE_URL = url.toString();
  return file;
}
