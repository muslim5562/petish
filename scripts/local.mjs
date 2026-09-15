import "./setup.mjs";
import "dotenv/config";
import { config } from "dotenv";
import { spawn } from "node:child_process";
import { Client } from "pg";
import path from "node:path";
config();
if (
  process.env.PETISH_DEMO !== "true" ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error(
    "The local launcher only supports the explicit loopback demo.",
  );
let database;
async function connected() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 1000,
  });
  try {
    await c.connect();
    await c.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}
function run(file, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [file, ...args], {
      stdio: "inherit",
      windowsHide: true,
    });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}`)),
    );
  });
}
if (!(await connected())) {
  database = spawn(process.execPath, ["scripts/database.mjs"], {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    windowsHide: true,
  });
  for (let i = 0; i < 45; i++) {
    if (await connected()) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!(await connected()))
    throw new Error(
      "Local PostgreSQL did not become ready. Check the terminal output.",
    );
}
await run("node_modules/prisma/build/index.js", ["generate"]);
await run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
await run("node_modules/tsx/dist/cli.mjs", ["prisma/seed.ts"]);
console.log("Open http://127.0.0.1:3000/login and choose Explore the demo.");
const app = spawn(
  process.execPath,
  [
    path.join("node_modules", "next", "dist", "bin", "next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  { stdio: "inherit", windowsHide: true },
);
function close() {
  app.kill("SIGTERM");
  if (database?.connected) database.send("shutdown");
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
app.on("exit", () => {
  if (database?.connected) database.send("shutdown");
});
