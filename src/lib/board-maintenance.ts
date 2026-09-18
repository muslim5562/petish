import { Client } from "pg";
import { maintainBoard } from "./board";
// A session advisory lock prevents concurrent workers across web replicas.
export async function runBoardMaintenance() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT pg_try_advisory_lock(724381903) AS locked",
    );
    if (!result.rows[0].locked) return;
    await maintainBoard();
  } finally {
    await client.end();
  }
}
export function startBoardMaintenance() {
  const g = globalThis as unknown as { boardMaintenanceStarted?: boolean };
  if (g.boardMaintenanceStarted) return;
  g.boardMaintenanceStarted = true;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runBoardMaintenance();
    } catch {
      console.error(
        "Lost & Found maintenance failed; the next scheduled run will retry.",
      );
    } finally {
      running = false;
    }
  };
  setTimeout(run, 30000).unref();
  setInterval(run, 30 * 60 * 1000).unref();
}
