import "dotenv/config";
import { db } from "../src/lib/db";
import { deleteObject } from "../src/lib/storage";
const cutoff = new Date(Date.now() - 30 * 86400000);
// Only individually removed files expire. Removed records remain restorable.
const files = await db.attachment.findMany({
  where: { deletedAt: { lt: cutoff } },
});
let count = 0;
for (const file of files) {
  await deleteObject(file.objectKey);
  if (file.thumbKey) await deleteObject(file.thumbKey);
  await db.attachment.delete({
    where: { id: file.id, deletedAt: { lt: cutoff } },
  });
  count++;
}
console.log(
  `Purged ${count} individually removed health files past their 30-day retention period.`,
);
await db.$disconnect();
