import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { getObject } from "../src/lib/storage";
import { db } from "../src/lib/db";
import {
  savePet,
  ownedPet,
  uploadPhoto,
  changePhoto,
  setPetState,
} from "../src/lib/pets";
test("custody isolation, persistence, image validation and concurrent three-photo limit", async () => {
  const owner = await db.user.findUniqueOrThrow({
    where: { email: "sarah@petish.test" },
  });
  const other = await db.user.findUniqueOrThrow({
    where: { email: "james@petish.test" },
  });
  const p = await savePet(owner.id, {
    name: "Integration test pet",
    species: "CAT",
  });
  try {
    assert.equal(p.visibility, "PRIVATE");
    assert.equal(
      await db.petOwnership.count({ where: { petId: p.id, endedAt: null } }),
      1,
    );
    await assert.rejects(() => ownedPet(other.id, p.id), /not found/);
    await assert.rejects(
      () => savePet(other.id, { name: "Stolen", species: "DOG" }, p.id),
      /not found/,
    );
    await savePet(owner.id, { name: "Persisted cat", species: "CAT" }, p.id);
    assert.equal((await ownedPet(owner.id, p.id)).name, "Persisted cat");
    await assert.rejects(
      () =>
        uploadPhoto(
          owner.id,
          p.id,
          new File(["not an image"], "fake.png", { type: "image/png" }),
          "FRONT",
        ),
      /valid/,
    );
    await assert.rejects(
      () =>
        uploadPhoto(
          owner.id,
          p.id,
          new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.jpg"),
          "FRONT",
        ),
      /10 MB/,
    );
    const buf = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#ffaa77" },
    })
      .withExif({ IFD0: { Artist: "Private metadata fixture" } })
      .jpeg()
      .toBuffer();
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        uploadPhoto(
          owner.id,
          p.id,
          new File([new Uint8Array(buf)], "photo.jpg", { type: "image/jpeg" }),
          "FRONT",
        ),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
    assert.equal(await db.petImage.count({ where: { petId: p.id } }), 3);
    const stored = await db.petImage.findFirstOrThrow({
      where: { petId: p.id },
    });
    const metadata = await sharp(await getObject(stored.objectKey)).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.format, "webp");
    await assert.rejects(
      () =>
        uploadPhoto(
          other.id,
          p.id,
          new File([new Uint8Array(buf)], "photo.jpg"),
          "FRONT",
        ),
      /not found/,
    );
    await assert.rejects(
      () => setPetState(owner.id, p.id, { visibility: "PUBLIC" }),
      /Preview/,
    );
    await setPetState(owner.id, p.id, {
      visibility: "PUBLIC",
      confirmed: true,
    });
    await setPetState(owner.id, p.id, { status: "DECEASED" });
    const memorial = await ownedPet(owner.id, p.id);
    assert.equal(memorial.visibility, "PRIVATE");
    assert.equal(memorial.id, p.id);
  } finally {
    const images = await db.petImage.findMany({ where: { petId: p.id } });
    for (const i of images) await changePhoto(owner.id, p.id, i.id, true);
    await db.auditLog.deleteMany({ where: { petId: p.id } });
    await db.pet.delete({ where: { id: p.id } });
    await db.$disconnect();
  }
});
