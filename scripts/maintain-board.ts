import "dotenv/config";
import { runBoardMaintenance } from "../src/lib/board-maintenance";
import { db } from "../src/lib/db";
try {
  await runBoardMaintenance();
  console.log("Lost & Found maintenance complete.");
} finally {
  await db.$disconnect();
}
