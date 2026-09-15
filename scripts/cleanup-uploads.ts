import "dotenv/config";
import { readdir, stat, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
if (
  process.env.PETISH_DEMO !== "true" ||
  process.env.STORAGE_DRIVER !== "local"
)
  throw new Error("This cleanup only supports the explicit local demo.");
const root = path.resolve(".local/objects");
const rows = await db.petImage.findMany({
  select: { objectKey: true, thumbKey: true },
});
const healthFiles = await db.attachment.findMany({
  select: { objectKey: true, thumbKey: true },
});
const referenced = new Set([
  ...rows.flatMap((r) => [r.objectKey, r.thumbKey]),
  ...healthFiles.flatMap((r) => [
    r.objectKey,
    ...(r.thumbKey ? [r.thumbKey] : []),
  ]),
]);
let removed = 0;
for (const directory of await readdir(root).catch(() => [])) {
  if (!/^[a-f0-9-]{36}$/.test(directory)) continue;
  for (const filename of ["full.webp", "thumb.webp", "document.pdf"]) {
    const key = `${directory}/${filename}`;
    if (referenced.has(key)) continue;
    const target = path.resolve(root, directory, filename);
    if (!target.startsWith(root + path.sep))
      throw new Error("Cleanup escaped its object directory");
    const info = await stat(target).catch(() => null);
    if (!info || Date.now() - info.mtimeMs < 86400000) continue;
    // Recheck immediately before removal so a concurrent upload can finish safely.
    if (
      await db.petImage.findFirst({
        where: { OR: [{ objectKey: key }, { thumbKey: key }] },
      })
    )
      continue;
    if (
      await db.attachment.findFirst({
        where: { OR: [{ objectKey: key }, { thumbKey: key }] },
      })
    )
      continue;
    await unlink(target);
    removed++;
  }
  await rmdir(path.join(root, directory)).catch(() => {});
}
console.log(`Removed ${removed} unreferenced local files older than 24 hours.`);
await db.$disconnect();
