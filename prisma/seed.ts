import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { putObject } from "../src/lib/storage";
if (
  process.env.PETISH_DEMO !== "true" ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Seeds are restricted to the local demo.");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const owners = [
  "Sarah Chen",
  "James Parker",
  "Maya Reed",
  "Alex Morgan",
  "Sam Taylor",
];
const emails = ["sarah", "james", "maya", "alex", "sam"];
const ids: string[] = [];
const hash = await hashPassword(process.env.DEMO_PASSWORD!);
for (let i = 0; i < owners.length; i++) {
  const email = `${emails[i]}@petish.test`;
  const owner = await db.user.upsert({
    where: { email },
    create: { name: owners[i], email, emailVerified: true },
    update: {},
  });
  ids.push(owner.id);
  const account = await db.account.findFirst({
    where: { userId: owner.id, providerId: "credential" },
  });
  if (!account)
    await db.account.create({
      data: {
        accountId: owner.id,
        userId: owner.id,
        providerId: "credential",
        password: hash,
      },
    });
}
const entries = [
  [
    "Milo",
    "DOG",
    "Golden retriever",
    "MALE",
    0,
    "golden-retriever.jpg",
    "PUBLIC",
    "ACTIVE",
    "Golden sunshine, long walks, and an enthusiastic hello for absolutely everyone.",
  ],
  [
    "Coco",
    "CAT",
    "Domestic shorthair",
    "FEMALE",
    0,
    "tabby-kitten.jpg",
    "PRIVATE",
    "ACTIVE",
    "A collector of sunbeams. Usually found in the warmest spot in the house.",
  ],
  [
    "Oreo",
    "DOG",
    "Border collie",
    "MALE",
    0,
    "black-white-dog.jpg",
    "PRIVATE",
    "ACTIVE",
    "Professional ball finder. Amateur puddle inspector. Full-time best friend.",
  ],
  [
    "Luna",
    "CAT",
    "Mixed breed",
    "FEMALE",
    1,
    "tabby-kitten.jpg",
    "PUBLIC",
    "ACTIVE",
    "Quiet mornings and cardboard boxes are her favourite things.",
  ],
  [
    "Teddy",
    "DOG",
    "Golden retriever",
    "UNKNOWN",
    1,
    "golden-retriever.jpg",
    "PRIVATE",
    "ACTIVE",
    "A gentle little companion.",
  ],
  [
    "Pepper",
    "DOG",
    "Border collie",
    "FEMALE",
    1,
    "black-white-dog.jpg",
    "PUBLIC",
    "ACTIVE",
    "Always ready for the next little adventure.",
  ],
  [
    "Bean",
    "CAT",
    "Domestic shorthair",
    "UNKNOWN",
    2,
    "tabby-kitten.jpg",
    "PRIVATE",
    "ACTIVE",
    "Small paws. A surprisingly big personality.",
  ],
  [
    "Archie",
    "DOG",
    "Mixed breed",
    "MALE",
    2,
    "golden-retriever.jpg",
    "PRIVATE",
    "ACTIVE",
    "Loves the garden and a good afternoon nap.",
  ],
  [
    "Mochi",
    "CAT",
    "Mixed breed",
    "FEMALE",
    2,
    "tabby-kitten.jpg",
    "PRIVATE",
    "ACTIVE",
    "Soft footsteps and very important opinions.",
  ],
  [
    "Scout",
    "DOG",
    "Border collie",
    "MALE",
    3,
    "black-white-dog.jpg",
    "PRIVATE",
    "ACTIVE",
    "Explorer of every corner of the neighbourhood.",
  ],
  [
    "Poppy",
    "CAT",
    "Domestic shorthair",
    "FEMALE",
    3,
    "tabby-kitten.jpg",
    "PRIVATE",
    "ARCHIVED",
    "A sweet familiar face.",
  ],
  [
    "Sunny",
    "DOG",
    "Golden retriever",
    "MALE",
    0,
    "golden-retriever.jpg",
    "PRIVATE",
    "DECEASED",
    "Forever our sunshine.",
  ],
] as const;
for (let index = 0; index < entries.length; index++) {
  const [
    name,
    species,
    breed,
    sex,
    ownerIndex,
    photo,
    visibility,
    status,
    description,
  ] = entries[index];
  const existing = await db.pet.findFirst({
    where: { name, ownerId: ids[ownerIndex] },
  });
  if (existing) continue;
  const imageId = randomUUID();
  const source = await readFile(
    path.join(process.cwd(), "public", "demo", photo),
  );
  const full = await sharp(source)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside" })
    .webp({ quality: 85 })
    .toBuffer();
  const thumb = await sharp(full)
    .resize(600, 600, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
  await putObject(`${imageId}/full.webp`, full);
  await putObject(`${imageId}/thumb.webp`, thumb);
  await db.$transaction(async (tx) => {
    const p = await tx.pet.create({
      data: {
        name,
        species,
        breed,
        sex,
        mixedBreed: breed === "Mixed breed",
        ownerId: ids[ownerIndex],
        visibility,
        status,
        description,
        area: ownerIndex === 0 ? "Maplewood" : null,
        colour:
          species === "CAT"
            ? "Tabby"
            : photo.startsWith("golden")
              ? "Golden"
              : "Black and white",
        birthPrecision: index === 4 ? "UNKNOWN" : "APPROXIMATE",
        birthDate:
          index === 4
            ? null
            : new Date(`${2021 + (index % 4)}-06-01T00:00:00Z`),
        microchip: index === 0 ? "DEMO-PRIVATE-0001" : null,
        ownerships: { create: { ownerId: ids[ownerIndex] } },
      },
    });
    await tx.petImage.create({
      data: {
        id: imageId,
        petId: p.id,
        uploadedBy: ids[ownerIndex],
        objectKey: `${imageId}/full.webp`,
        thumbKey: `${imageId}/thumb.webp`,
        bytes: full.length + thumb.length,
        view: "FRONT",
      },
    });
    await tx.pet.update({
      where: { id: p.id },
      data: { mainImageId: imageId },
    });
    await tx.auditLog.create({
      data: { actorId: ids[ownerIndex], petId: p.id, action: "Added a pet" },
    });
  });
}
console.log(
  "Demo ready: five owners and twelve pets. Existing demo records were preserved.",
);
await db.$disconnect();
await import("./seed-health");
