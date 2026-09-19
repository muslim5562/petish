import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
import { putObject, getObject } from "../src/lib/storage";

if (
  process.env.PETISH_DEMO !== "true" ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  ) ||
  process.env.STORAGE_DRIVER !== "local"
)
  throw Error(
    "Sample accounts can only be added to the local sample database.",
  );
const id = (key: string) => {
  const h = createHash("sha256")
    .update("petish-sample-households-v1:" + key)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const ago = (days: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
};
const owners = [
  { key: "aisha", name: "Aisha Rahman", email: "aisha@petish.test" },
  { key: "farid", name: "Farid Hassan", email: "farid@petish.test" },
];
const specs = [
  {
    owner: 0,
    name: "Nala",
    species: "CAT",
    breed: "Domestic shorthair",
    colour: "Tabby",
    sex: "FEMALE",
    photo: "tabby-kitten.jpg",
    area: "Shah Alam",
    stray: false,
  },
  {
    owner: 0,
    name: "Biscuit",
    species: "DOG",
    breed: "Golden retriever",
    colour: "Golden",
    sex: "MALE",
    photo: "golden-retriever.jpg",
    area: "Shah Alam",
    stray: false,
  },
  {
    owner: 0,
    name: "Scout",
    species: "DOG",
    breed: "Border collie",
    colour: "Black and white",
    sex: "MALE",
    photo: "black-white-dog.jpg",
    area: "Shah Alam",
    stray: false,
  },
  ...[
    "Mochi",
    "Amber",
    "Patch",
    "Cinnamon",
    "Socks",
    "Maple",
    "Ash",
    "Daisy",
    "Comet",
    "Olive",
  ].map((name, i) => ({
    owner: 1,
    name,
    species: i % 3 === 2 ? "DOG" : "CAT",
    breed: "Mixed breed",
    colour: ["Cream", "Ginger", "Black and white", "Brown", "Grey and white"][
      i % 5
    ],
    sex: i % 2 ? "FEMALE" : "MALE",
    photo: "",
    area: ["Petaling Jaya", "Subang Jaya", "Klang"][i % 3],
    stray: i >= 6,
  })),
];
type Credentials = {
  name: string;
  email: string;
  password: string;
  petCount: number;
}[];
await mkdir(".local", { recursive: true });
let credentials: Credentials = [];
try {
  credentials = JSON.parse(
    await readFile(".local/sample-accounts.json", "utf8"),
  );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
async function picture(
  key: string,
  name: string,
  index: number,
  source?: string,
) {
  const palette = [
    "#e7c8ae",
    "#d4d8ed",
    "#c9ded2",
    "#f0d5a9",
    "#e5c7d5",
    "#cbdde8",
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="560"><rect width="700" height="560" fill="${palette[index % palette.length]}"/><g fill="#47394d"><ellipse cx="350" cy="255" rx="80" ry="62"/><ellipse cx="248" cy="175" rx="32" ry="44" transform="rotate(-25 248 175)"/><ellipse cx="315" cy="140" rx="31" ry="43"/><ellipse cx="389" cy="140" rx="31" ry="43"/><ellipse cx="454" cy="175" rx="32" ry="44" transform="rotate(25 454 175)"/></g><text x="350" y="420" font-family="Arial" font-size="54" font-weight="bold" text-anchor="middle" fill="#47394d">${name}</text><text x="350" y="475" font-family="Arial" font-size="22" text-anchor="middle" fill="#625369">FICTIONAL SAMPLE PET</text></svg>`;
  const buffer = source
    ? await readFile(`public/demo/${source}`)
    : Buffer.from(svg);
  const full = await sharp(buffer)
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
  const thumb = await sharp(full)
    .resize({
      width: 600,
      height: 600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  const imageId = id(key);
  const objectKey = `${imageId}/full.webp`,
    thumbKey = `${imageId}/thumb.webp`;
  await putObject(objectKey, full);
  await putObject(thumbKey, thumb);
  return {
    id: imageId,
    objectKey,
    thumbKey,
    bytes: full.length + thumb.length,
  };
}
try {
  for (const [i, o] of owners.entries()) {
    const userId = id(o.key);
    const existing = await db.user.findUnique({ where: { email: o.email } });
    if (existing && existing.id !== userId)
      throw Error(
        `Account ${o.email} already exists outside this sample set; no changes made to it.`,
      );
    if (!existing) {
      const password = `Petish-${randomBytes(12).toString("base64url")}!`;
      const entry = {
        name: o.name,
        email: o.email,
        password,
        petCount: i === 0 ? 3 : 10,
      };
      credentials = credentials.filter((c) => c.email !== o.email);
      credentials.push(entry);
      // Persist the new credential before creating the account so interrupted runs retain it.
      await writeFile(
        ".local/sample-accounts.json",
        JSON.stringify(credentials, null, 2),
      );
      const passwordHash = await hashPassword(password);
      await db.user.create({
        data: {
          id: userId,
          name: o.name,
          email: o.email,
          emailVerified: true,
          accounts: {
            create: {
              providerId: "credential",
              accountId: userId,
              password: passwordHash,
            },
          },
        },
      });
    }
  }
  for (const [index, p] of specs.entries()) {
    const petId = id(`pet:${p.name}`),
      ownerId = id(owners[p.owner].key);
    if (await db.pet.findUnique({ where: { id: petId } })) continue;
    const img = await picture(`pet-photo:${p.name}`, p.name, index, p.photo);
    await db.$transaction(async (tx) => {
      await tx.pet.create({
        data: {
          id: petId,
          ownerId,
          name: p.name,
          species: p.species as "CAT" | "DOG",
          sex: p.sex as "MALE" | "FEMALE",
          breed: p.breed,
          mixedBreed: p.breed === "Mixed breed",
          colour: p.colour,
          birthPrecision: "APPROXIMATE",
          birthDate: new Date(`${2020 + (index % 5)}-06-15`),
          careType: p.stray ? "CARE_STRAY" : "INHOUSE",
          normalLocation: p.stray
            ? `Fictional feeding point ${index - 5}, ${p.area}`
            : null,
          area: p.area,
          description: `Fictional sample profile. ${p.name} enjoys ${["quiet afternoons", "playing with toys", "gentle walks", "sunny windows"][index % 4]}.`,
          visibility: "PRIVATE",
          ownerships: { create: { ownerId } },
        },
      });
      await tx.petImage.create({
        data: { ...img, petId, uploadedBy: ownerId, view: "FRONT" },
      });
      await tx.pet.update({
        where: { id: petId },
        data: { mainImageId: img.id },
      });
      await tx.auditLog.create({
        data: { actorId: ownerId, petId, action: "Added fictional sample pet" },
      });
    });
  }
  const cases = [
    {
      key: "missing-nala",
      pet: "Nala",
      owner: 0,
      kind: "MISSING",
      area: "Seksyen 7, Shah Alam",
      days: 2,
      state: "OPEN",
      reward: "Sample reward: RM 100",
    },
    {
      key: "missing-mochi",
      pet: "Mochi",
      owner: 1,
      kind: "MISSING",
      area: "SS2, Petaling Jaya",
      days: 5,
      state: "OPEN",
      reward: "",
    },
    {
      key: "missing-ash",
      pet: "Ash",
      owner: 1,
      kind: "MISSING",
      area: "Taman Berkeley, Klang",
      days: 1,
      state: "OPEN",
      reward: "",
    },
    {
      key: "found-cat-1",
      pet: "Cream cat",
      owner: 0,
      kind: "FOUND",
      area: "USJ 2, Subang Jaya",
      days: 1,
      state: "OPEN",
      reward: "",
    },
    {
      key: "found-dog-1",
      pet: "Brown dog",
      owner: 1,
      kind: "FOUND",
      area: "Kota Kemuning, Shah Alam",
      days: 3,
      state: "OPEN",
      reward: "",
    },
    {
      key: "found-cat-2",
      pet: "Grey cat",
      owner: 1,
      kind: "FOUND",
      area: "Taman Paramount, Petaling Jaya",
      days: 4,
      state: "OPEN",
      reward: "",
    },
    {
      key: "found-dog-2",
      pet: "Spotted dog",
      owner: 0,
      kind: "FOUND",
      area: "Bandar Botanic, Klang",
      days: 6,
      state: "OPEN",
      reward: "",
    },
    {
      key: "found-cat-3",
      pet: "Ginger cat",
      owner: 1,
      kind: "FOUND",
      area: "Setia Alam, Shah Alam",
      days: 2,
      state: "OPEN",
      reward: "",
    },
    {
      key: "closed-scout",
      pet: "Scout",
      owner: 0,
      kind: "MISSING",
      area: "Seksyen 13, Shah Alam",
      days: 15,
      state: "CLOSED",
      reward: "",
    },
    {
      key: "closed-found",
      pet: "Reunited tabby",
      owner: 1,
      kind: "FOUND",
      area: "SS15, Subang Jaya",
      days: 12,
      state: "CLOSED",
      reward: "",
    },
  ];
  for (const [index, c] of cases.entries()) {
    const reportId = id(`report:${c.key}`);
    if (await db.boardReport.findUnique({ where: { id: reportId } })) continue;
    const p = specs.find((p) => p.name === c.pet);
    const missing = c.kind === "MISSING";
    const ownerId = id(owners[c.owner].key);
    const species =
      p?.species || (c.pet.toLowerCase().includes("dog") ? "DOG" : "CAT");
    let img;
    if (missing) {
      const source = await db.petImage.findUniqueOrThrow({
        where: { id: id(`pet-photo:${c.pet}`) },
      });
      const photoId = id(`report-photo:${c.key}`);
      const full = await getObject(source.objectKey),
        thumb = await getObject(source.thumbKey);
      img = {
        id: photoId,
        objectKey: `${photoId}/full.webp`,
        thumbKey: `${photoId}/thumb.webp`,
        bytes: full.length + thumb.length,
      };
      await putObject(img.objectKey, full);
      await putObject(img.thumbKey, thumb);
    } else img = await picture(`report-photo:${c.key}`, c.pet, index + 3);
    await db.boardReport.create({
      data: {
        id: reportId,
        ownerId,
        email: owners[c.owner].email,
        kind: c.kind,
        state: c.state,
        petId: missing ? id(`pet:${c.pet}`) : null,
        petName: missing ? c.pet : `[Sample] ${c.pet}`,
        species,
        breed: p?.breed || "Unknown",
        colour: p?.colour || c.pet.split(" ")[0],
        details: `FICTIONAL SAMPLE REPORT — for testing Petish only. ${missing ? `${c.pet} was last seen near the neighbourhood park. Please submit a sample sighting to try the response workflow.` : index % 2 ? "This pet is resting safely with the sample finder. Submit a private sample claim to test the reunion workflow." : "This pet was seen roaming near a community garden. Exact ownership is unknown."}`,
        locality: c.area,
        occurredAt: ago(c.days),
        confirmedAt: ago(Math.min(c.days, 4)),
        createdAt: ago(c.days),
        custody: missing ? null : index % 2 ? "IN_CARE" : "ROAMING",
        phone: missing ? "SAMPLE — not a real number" : null,
        publicPhone: missing,
        reward: c.reward,
        photoReuse: true,
        closedAt: c.state === "CLOSED" ? ago(c.days - 2) : null,
        closureReason: c.state === "CLOSED" ? "REUNITED" : null,
        photos: { create: img },
      },
    });
    if (index === 0 || index === 1 || index === 4) {
      const responder = owners[1 - c.owner],
        responseId = id(`reply:${c.key}`);
      await db.boardResponse.create({
        data: {
          id: responseId,
          reportId,
          email: responder.email,
          verified: true,
          kind: missing ? "SEEN" : "CLAIM",
          locality: c.area,
          occurredAt: ago(1),
          details: missing
            ? "Fictional sample sighting: a similar pet was near the park entrance this morning."
            : "Fictional sample claim: the coat markings resemble my pet. I can provide older photos for comparison.",
        },
      });
      await db.boardNotification.create({
        data: {
          id: id(`notice:${c.key}`),
          reportId,
          ownerId,
          email: owners[c.owner].email,
          subject: missing
            ? "Sample: a possible sighting was submitted"
            : "Sample: someone thinks this may be their pet",
          sentAt: new Date(),
          attempts: 0,
        },
      });
    }
  }
  await writeFile(
    ".local/sample-accounts.txt",
    credentials
      .map(
        (c) =>
          `${c.name} — ${c.petCount} pets\nEmail: ${c.email}\nPassword: ${c.password}\n`,
      )
      .join("\n") +
      "\nSign in at http://127.0.0.1:3000/login using the email/password form.\nLocal fictional accounts only. These addresses do not receive external email.\n",
  );
  for (const o of owners)
    console.log(
      `${o.name}: ${await db.pet.count({ where: { ownerId: id(o.key) } })} pets (${o.email})`,
    );
  console.log(
    `Sample bulletin: ${await db.boardReport.count({ where: { id: { in: cases.map((c) => id(`report:${c.key}`)) }, state: "OPEN" } })} open reports, 2 closed cases. Credentials saved to .local/sample-accounts.txt.`,
  );
} finally {
  await db.$disconnect();
}
