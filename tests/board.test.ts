import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile, unlink } from "node:fs/promises";
import sharp from "sharp";
import { db } from "../src/lib/db";
import {
  createReport,
  respond,
  manage,
  verifyResponse,
  visible,
  publicReport,
  photoResponse,
  importReport,
  tokenAccess,
  maintainBoard,
  moderator,
  rate,
} from "../src/lib/board";
import { deleteObject } from "../src/lib/storage";
const origin = "http://127.0.0.1:3000";
const request = () =>
  new Request(origin + "/api/lost-found/manage", {
    method: "POST",
    headers: { origin },
  });
async function mailToken(email: string, suffix: string) {
  const files = (await readdir(".local/mail")).sort().reverse();
  for (const f of files) {
    const d = JSON.parse(await readFile(`.local/mail/${f}`, "utf8"));
    if (d.to === email && new URL(d.url).pathname.endsWith(suffix))
      return new URL(d.url).hash.slice(1);
  }
  throw Error("Expected a captured verification email");
}
test("lost/found verification, private replies, closure, expiry, and reunion ownership", async () => {
  assert.equal(
    process.env.MAIL_MODE,
    "local",
    "This integration test requires captured local mail",
  );
  const tag = randomUUID();
  const owner = await db.user.create({
    data: {
      name: "Board test owner",
      email: `board-owner-${tag}@example.test`,
      emailVerified: true,
    },
  });
  const claimant = await db.user.create({
    data: {
      name: "Board test claimant",
      email: `board-claim-${tag}@example.test`,
      emailVerified: true,
    },
  });
  const guest = `board-guest-${tag}@example.test`;
  const reports: string[] = [],
    pets: string[] = [];
  const img = await sharp({
    create: { width: 30, height: 30, channels: 3, background: "#c99070" },
  })
    .png()
    .toBuffer();
  async function form(data: object, count = 1, corrupt = false) {
    const f = new FormData();
    f.set("data", JSON.stringify(data));
    for (let i = 0; i < count; i++)
      f.append(
        "photos",
        new File(
          [new Uint8Array(corrupt ? Buffer.from("not a photo") : img)],
          "pet.png",
          { type: "image/png" },
        ),
      );
    return new Request(origin + "/api/lost-found", {
      method: "POST",
      headers: { origin },
      body: f,
    });
  }
  const common = {
    kind: "FOUND",
    species: "CAT",
    details: "Fictional cat with white paws",
    locality: "Test neighbourhood",
    occurredAt: "2026-09-01",
    custody: "IN_CARE",
    consent: true,
    phone: "0123456789",
    publicPhone: false,
    email: guest,
    photoReuse: true,
  };
  try {
    const p = await db.pet.create({
      data: {
        name: "Board test pet",
        species: "CAT",
        ownerId: owner.id,
        normalLocation: "SECRET FEEDING LOCATION",
        microchip: "SECRET CHIP",
        careType: "CARE_STRAY",
        ownerships: { create: { ownerId: owner.id } },
      },
    });
    pets.push(p.id);
    const missing = await createReport(
      await form({
        ...common,
        kind: "MISSING",
        petId: p.id,
        petName: p.name,
        publicPhone: true,
      }),
      owner,
    );
    reports.push(missing.id);
    const r = await db.boardReport.findUniqueOrThrow({
      where: { id: missing.id },
    });
    assert.equal(await visible(r), true);
    const card = await publicReport(r),
      detail = await publicReport(r, true);
    assert.equal("phone" in card, false);
    assert.equal(detail.phone, common.phone);
    const serialized = JSON.stringify(detail);
    for (const secret of [
      owner.email,
      owner.id,
      p.id,
      "SECRET",
      "objectKey",
      "tokenHash",
    ])
      assert.equal(serialized.includes(secret), false);
    await assert.rejects(manage(request(), claimant, { id: r.id }));
    await assert.rejects(
      createReport(
        await form({
          ...common,
          kind: "MISSING",
          petId: p.id,
          publicPhone: true,
        }),
        owner,
      ),
    );
    await assert.rejects(
      createReport(
        await form({
          ...common,
          kind: "MISSING",
          petId: p.id,
          publicPhone: true,
        }),
        claimant,
      ),
    );
    const replyData = {
      email: guest,
      kind: "SEEN",
      locality: "Test park",
      occurredAt: "2026-09-02",
      details: "A similar cat near a bench",
      consent: true,
    };
    await respond(await form(replyData), r.id, null);
    let managed = await manage(request(), owner, { id: r.id });
    assert.equal(managed.responses.length, 0);
    const verify = await mailToken(guest, "/verify");
    assert.equal(verify.length, 43);
    const stored = await tokenAccess(verify);
    assert.notEqual(stored?.tokenHash, verify);
    await verifyResponse(verify);
    await verifyResponse(verify);
    managed = await manage(request(), owner, { id: r.id });
    assert.equal(managed.responses.length, 1);
    assert.equal(
      await db.boardNotification.count({ where: { reportId: r.id } }),
      1,
    );
    const privatePhoto = managed.responses[0].photos[0].id;
    await assert.rejects(photoResponse(privatePhoto, null));
    await assert.rejects(photoResponse(privatePhoto, claimant));
    assert.equal((await photoResponse(privatePhoto, owner)).status, 200);
    assert.equal(
      (await photoResponse(detail.photos[0].id, null)).headers.get(
        "Cache-Control",
      ),
      "private, no-store",
    );
    await manage(request(), owner, {
      id: r.id,
      action: "close",
      reason: "REUNITED",
    });
    assert.equal(
      await visible(
        await db.boardReport.findUniqueOrThrow({ where: { id: r.id } }),
      ),
      false,
    );
    await assert.rejects(photoResponse(detail.photos[0].id, null));
    assert.equal(
      (await manage(request(), owner, { id: r.id })).responses.length,
      1,
    );
    await manage(request(), owner, { id: r.id, action: "renew" });
    await db.pet.update({ where: { id: p.id }, data: { status: "REHOMED" } });
    assert.equal(
      await visible(
        await db.boardReport.findUniqueOrThrow({ where: { id: r.id } }),
      ),
      false,
    );
    await assert.rejects(
      manage(request(), owner, { id: r.id, action: "renew" }),
    );

    const found = await createReport(await form(common, 2), null);
    reports.push(found.id);
    assert.equal(found.state, "PENDING");
    let foundRow = await db.boardReport.findUniqueOrThrow({
      where: { id: found.id },
    });
    assert.equal(await visible(foundRow), false);
    const token = await mailToken(guest, "/manage");
    await assert.rejects(manage(request(), null, { id: r.id, token }));
    await manage(request(), null, { token, action: "publish" });
    foundRow = await db.boardReport.findUniqueOrThrow({
      where: { id: found.id },
    });
    assert.equal(await visible(foundRow), true);
    assert.equal("phone" in (await publicReport(foundRow, true)), false);
    await respond(
      await form({ ...replyData, email: claimant.email, kind: "CLAIM" }),
      found.id,
      claimant,
    );
    const foundManaged = await manage(request(), null, { token });
    await manage(request(), null, {
      token,
      action: "close",
      reason: "REUNITED",
      claimId: foundManaged.responses[0].id,
    });
    const invitation = await mailToken(claimant.email, "/reunited");
    await assert.rejects(
      importReport(null, { token: invitation, action: "preview" }),
    );
    await assert.rejects(
      importReport(owner, { token: invitation, action: "preview" }),
    );
    await assert.rejects(
      photoResponse(
        foundManaged.responses[0].photos[0].id,
        claimant,
        invitation,
      ),
    );
    assert.equal(
      (await importReport(claimant, { token: invitation, action: "preview" }))
        .species,
      "CAT",
    );
    const imported = await importReport(claimant, {
      token: invitation,
      name: "Reunited fixture",
      confirm: true,
      copyPhotos: true,
    });
    assert.ok("petId" in imported);
    const importedId = (imported as { petId: string }).petId;
    pets.push(importedId);
    assert.equal(
      (await db.pet.findUniqueOrThrow({ where: { id: importedId } }))
        .visibility,
      "PRIVATE",
    );
    assert.equal(await db.petImage.count({ where: { petId: importedId } }), 2);
    assert.equal(
      (
        (await importReport(claimant, {
          token: invitation,
          name: "Ignored repeat",
          confirm: true,
        })) as { petId: string }
      ).petId,
      importedId,
    );
    await db.boardAccess.updateMany({
      where: { reportId: found.id },
      data: { expiresAt: new Date(0) },
    });
    await assert.rejects(manage(request(), null, { token }));
    await assert.rejects(
      importReport(claimant, { token: invitation, action: "preview" }),
    );
    await assert.rejects(
      createReport(
        await form({ ...common, email: `invalid-${tag}@example.test` }, 3),
        null,
      ),
    );
    await assert.rejects(
      createReport(
        await form(
          { ...common, email: `invalid-${tag}@example.test` },
          1,
          true,
        ),
        null,
      ),
    );
    await assert.rejects(
      createReport(await form({ ...common, consent: false }), null),
    );
    await assert.rejects(
      createReport(await form({ ...common, occurredAt: "2026-02-31" }), null),
    );
    assert.equal(moderator(owner), false);
    process.env.LOST_FOUND_MODERATOR_EMAILS = owner.email;
    assert.equal(moderator(owner), true);
    delete process.env.LOST_FOUND_MODERATOR_EMAILS;
    await rate(`test-${tag}`, 1);
    await assert.rejects(rate(`test-${tag}`, 1));
    await db.boardReport.update({
      where: { id: found.id },
      data: {
        state: "OPEN",
        confirmedAt: new Date(Date.now() - 31 * 86400000),
      },
    });
    await maintainBoard();
    await maintainBoard();
    assert.equal(
      await db.boardNotification.count({
        where: { reportId: found.id, subject: { startsWith: "Is your" } },
      }),
      1,
    );
    await db.boardReport.update({
      where: { id: found.id },
      data: { confirmedAt: new Date(Date.now() - 61 * 86400000) },
    });
    assert.equal(
      await visible(
        await db.boardReport.findUniqueOrThrow({ where: { id: found.id } }),
      ),
      false,
    );
    await maintainBoard();
    assert.equal(
      (await db.boardReport.findUniqueOrThrow({ where: { id: found.id } }))
        .state,
      "ARCHIVED",
    );
  } finally {
    const images = await db.boardPhoto.findMany({
      where: { reportId: { in: reports } },
    });
    const petImages = await db.petImage.findMany({
      where: { petId: { in: pets } },
    });
    for (const p of [...images, ...petImages]) {
      await deleteObject(p.objectKey);
      await deleteObject(p.thumbKey);
    }
    await db.boardNotification.deleteMany({
      where: { reportId: { in: reports } },
    });
    await db.boardReport.deleteMany({ where: { id: { in: reports } } });
    await db.auditLog.deleteMany({ where: { petId: { in: pets } } });
    await db.pet.deleteMany({ where: { id: { in: pets } } });
    await db.user.deleteMany({
      where: { id: { in: [owner.id, claimant.id] } },
    });
    for (const f of await readdir(".local/mail")) {
      const d = JSON.parse(await readFile(`.local/mail/${f}`, "utf8"));
      if ([guest, owner.email, claimant.email].includes(d.to))
        await unlink(`.local/mail/${f}`);
    }
    await db.$disconnect();
  }
});
