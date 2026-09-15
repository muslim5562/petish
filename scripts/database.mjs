import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";
const dir = path.join(process.cwd(), ".local", "postgres");
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "petish",
  password: process.env.PG_PASSWORD,
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (message) => console.error(String(message)),
});
if (!existsSync(path.join(dir, "PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const found = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='petish'",
);
await client.end();
if (!found.rowCount) await pg.createDatabase("petish");
console.log(
  "Petish PostgreSQL is listening on 127.0.0.1:55432. Keep this process running.",
);
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("message", (message) => {
  if (message === "shutdown") void stop();
});
setInterval(() => {}, 60000);
