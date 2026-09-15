import "dotenv/config";
import { db } from "../src/lib/db";
import { changePhoto } from "../src/lib/pets";
if (
  process.env.PETISH_DEMO !== "true" ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Test cleanup is restricted to the local demo.");
const sarah = await db.user.findUniqueOrThrow({
  where: { email: "sarah@petish.test" },
});
const pets = await db.pet.findMany({
  where: { ownerId: sarah.id, name: { in: ["Pip QA", "Photo QA"] } },
  include: { images: true },
});
for (const p of pets) {
  for (const i of p.images) await changePhoto(sarah.id, p.id, i.id, true);
  await db.auditLog.deleteMany({ where: { petId: p.id } });
  await db.pet.delete({ where: { id: p.id } });
}
const users = await db.user.findMany({
  where: {
    email: { startsWith: "qa-", endsWith: "@petish.test" },
    name: "Test Parent",
  },
});
for (const u of users) {
  if (await db.pet.count({ where: { ownerId: u.id } })) continue;
  await db.deletionRequest.deleteMany({ where: { userId: u.id } });
  await db.auditLog.deleteMany({ where: { actorId: u.id } });
  await db.user.delete({ where: { id: u.id } });
}
console.log(
  `Removed ${pets.length} test pets and ${users.length} temporary test accounts. Seeded and other records preserved.`,
);
await db.$disconnect();
