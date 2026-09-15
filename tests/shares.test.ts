import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { savePet } from "../src/lib/pets";
import { saveHealthRecord } from "../src/lib/health";
import {
  previewSummary,
  createSummaryShare,
  resolveSummaryShare,
  revokeSummaryShare,
  listSummaryShares,
} from "../src/lib/shares";
import { defaultSelection, createShareInput } from "../src/lib/share-rules";
test("sharing defaults protect identity and require explicit unlimited-link consent", () => {
  assert.equal(defaultSelection.ownerName, false);
  assert.equal(defaultSelection.microchip, false);
  const id = "e23914ca-79a9-4a9f-9d74-54b5fd098e6b";
  assert.equal(
    createShareInput.parse({ snapshotId: id, confirmBearer: true }).expiry,
    "DAY",
  );
  assert.equal(
    createShareInput.safeParse({
      snapshotId: id,
      confirmBearer: true,
      expiry: "UNTIL_REVOKED",
    }).success,
    false,
  );
  assert.equal(
    createShareInput.safeParse({ snapshotId: id, confirmBearer: false })
      .success,
    false,
  );
});
test("snapshot selection, immutable history, hash-only tokens, expiry, revocation and custody safeguards", async (t) => {
  const owner = await db.user.findUniqueOrThrow({
      where: { email: "sarah@petish.test" },
    }),
    other = await db.user.findUniqueOrThrow({
      where: { email: "james@petish.test" },
    });
  const pet = await savePet(owner.id, {
    name: "Sharing integration fixture",
    species: "DOG",
    microchip: "EXCLUDED-MICROCHIP-SECRET",
  });
  try {
    let visit = await saveHealthRecord(owner.id, pet.id, {
      kind: "VISIT",
      title: "Synthetic visit",
      occurredOn: "2026-01-01",
      datePrecision: "EXACT",
      outcome: "Original frozen outcome",
    });
    const draft = await previewSummary(owner.id, pet.id, defaultSelection);
    assert.equal(JSON.stringify(draft.content).includes(owner.name), false);
    assert.equal(
      JSON.stringify(draft.content).includes("EXCLUDED-MICROCHIP-SECRET"),
      false,
    );
    assert.equal(JSON.stringify(draft.content).includes(visit.id), false);
    assert.equal(
      JSON.stringify(draft.content).includes('"attachments":'),
      false,
    );
    await assert.rejects(
      () => previewSummary(other.id, pet.id, defaultSelection),
      /not found/,
    );
    visit = await saveHealthRecord(
      owner.id,
      pet.id,
      {
        kind: "VISIT",
        title: "Synthetic visit",
        occurredOn: "2026-01-01",
        datePrecision: "EXACT",
        outcome: "Later corrected outcome",
        version: visit.version,
      },
      visit.id,
    );
    const share = await createSummaryShare(owner.id, pet.id, {
      snapshotId: draft.id,
      confirmBearer: true,
    });
    const token = new URL(share.url).hash.slice(1);
    assert.equal(token.length, 43);
    assert.equal(new URL(share.url).pathname, "/shared");
    const stored = await db.healthSummaryShare.findUniqueOrThrow({
      where: { id: share.id },
    });
    assert.match(stored.tokenHash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(stored).includes(token), false);
    assert.equal(
      stored.expiresAt!.getTime() - stored.createdAt.getTime(),
      86400000,
    );
    const received = await resolveSummaryShare(token);
    assert.equal(
      JSON.stringify(received.content).includes("Original frozen outcome"),
      true,
    );
    assert.equal(
      JSON.stringify(received.content).includes("Later corrected outcome"),
      false,
    );
    assert.equal(share.qr.startsWith("data:image/png;base64,"), true);
    await assert.rejects(
      () =>
        createSummaryShare(owner.id, pet.id, {
          snapshotId: draft.id,
          confirmBearer: true,
        }),
      /already created/,
    );
    await assert.rejects(
      () =>
        db.healthSummarySnapshot.update({
          where: { id: draft.id },
          data: { content: { modified: true } },
        }),
      /immutable/,
    );
    await assert.rejects(
      () =>
        db.healthSummaryShare.update({
          where: { id: share.id },
          data: { expiresAt: null },
        }),
      /cannot be changed/,
    );
    await assert.rejects(
      () => revokeSummaryShare(other.id, pet.id, share.id),
      /not found/,
    );
    t.mock.timers.enable({ apis: ["Date"], now: stored.expiresAt!.getTime() });
    await assert.rejects(() => resolveSummaryShare(token), /not available/);
    t.mock.timers.reset();
    await revokeSummaryShare(owner.id, pet.id, share.id);
    await assert.rejects(() => resolveSummaryShare(token), /not available/);
    assert.equal(
      (await listSummaryShares(owner.id, pet.id)).shares[0].status,
      "Revoked",
    );
    const omitted = await previewSummary(owner.id, pet.id, {
      ...defaultSelection,
      petName: false,
      demographics: false,
      sections: [],
      freeText: false,
    });
    assert.equal(omitted.content.identity.length, 0);
    assert.equal(omitted.content.sections.length, 0);
    const included = await previewSummary(owner.id, pet.id, {
      ...defaultSelection,
      ownerName: true,
      microchip: true,
      excludedRecordIds: [visit.id],
    });
    assert.equal(
      JSON.stringify(included.content).includes("EXCLUDED-MICROCHIP-SECRET"),
      true,
    );
    assert.equal(
      JSON.stringify(included.content).includes("Synthetic visit"),
      false,
    );
    for (const [expiry, duration] of [
      ["HOUR", 3600000],
      ["WEEK", 604800000],
      ["UNTIL_REVOKED", null],
    ] as const) {
      const d = await previewSummary(owner.id, pet.id, defaultSelection);
      const link = await createSummaryShare(owner.id, pet.id, {
        snapshotId: d.id,
        confirmBearer: true,
        expiry,
        confirmNoExpiry: expiry === "UNTIL_REVOKED",
      });
      assert.equal(
        link.expiresAt
          ? link.expiresAt.getTime() - link.createdAt.getTime()
          : null,
        duration,
      );
    }
    const old = await previewSummary(owner.id, pet.id, defaultSelection);
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 16 * 60000 });
    await assert.rejects(
      () =>
        createSummaryShare(owner.id, pet.id, {
          snapshotId: old.id,
          confirmBearer: true,
        }),
      /expired/,
    );
    t.mock.timers.reset();
    const liveDraft = await previewSummary(owner.id, pet.id, defaultSelection);
    const live = await createSummaryShare(owner.id, pet.id, {
      snapshotId: liveDraft.id,
      confirmBearer: true,
    });
    await assert.rejects(
      () =>
        db.pet.update({ where: { id: pet.id }, data: { ownerId: other.id } }),
      /custody/,
    );
    await resolveSummaryShare(new URL(live.url).hash.slice(1));
    await db.$transaction(async (tx) => {
      await tx.petOwnership.updateMany({
        where: { petId: pet.id, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.petOwnership.create({
        data: { petId: pet.id, ownerId: other.id },
      });
      await tx.pet.update({
        where: { id: pet.id },
        data: { ownerId: other.id },
      });
    });
    assert.ok(
      (
        await db.healthSummaryShare.findUniqueOrThrow({
          where: { id: live.id },
        })
      ).revokedAt,
    );
    await assert.rejects(
      () => resolveSummaryShare(new URL(live.url).hash.slice(1)),
      /not available/,
    );
    await db.$transaction(async (tx) => {
      await tx.petOwnership.updateMany({
        where: { petId: pet.id, endedAt: null },
        data: { endedAt: new Date() },
      });
      await tx.petOwnership.create({
        data: { petId: pet.id, ownerId: owner.id },
      });
      await tx.pet.update({
        where: { id: pet.id },
        data: { ownerId: owner.id },
      });
    });
    await assert.rejects(
      () => resolveSummaryShare(new URL(live.url).hash.slice(1)),
      /not available/,
    );
  } finally {
    t.mock.timers.reset();
    await db.auditLog.deleteMany({ where: { petId: pet.id } });
    await db.pet.delete({ where: { id: pet.id } });
    await db.$disconnect();
  }
});
