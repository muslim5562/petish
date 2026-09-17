import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { savePet, setPetState } from "../src/lib/pets";
import {
  previewSummary,
  createSummaryShare,
  resolveSummaryShare,
} from "../src/lib/shares";
test("care location validation and confirmed rehoming revoke old links", async () => {
  const owner = await db.user.findUniqueOrThrow({
    where: { email: "sarah@petish.test" },
  });
  const p = await savePet(owner.id, {
    name: "Care rules fixture",
    species: "DOG",
    careType: "CARE_STRAY",
    normalLocation: "Private test location",
  });
  try {
    assert.equal(p.careType, "CARE_STRAY");
    await assert.rejects(
      savePet(
        owner.id,
        { name: p.name, species: "DOG", careType: "CARE_STRAY" },
        p.id,
      ),
    );
    const draft = await previewSummary(owner.id, p.id, {});
    const link = await createSummaryShare(owner.id, p.id, {
      snapshotId: draft.id,
      confirmBearer: true,
    });
    const token = new URL(link.url).hash.slice(1);
    await assert.rejects(setPetState(owner.id, p.id, { status: "REHOMED" }));
    await resolveSummaryShare(token);
    await assert.rejects(
      setPetState(owner.id, p.id, {
        status: "REHOMED",
        confirmed: true,
        recipientEmail: "unregistered@example.test",
      }),
    );
    const moved = await setPetState(owner.id, p.id, {
      status: "REHOMED",
      confirmed: true,
      recipientEmail: "james@petish.test",
    });
    assert.equal(moved.status, "REHOMED");
    assert.equal(moved.visibility, "PRIVATE");
    assert.equal(moved.ownerId, owner.id);
    await assert.rejects(resolveSummaryShare(token));
    await setPetState(owner.id, p.id, { status: "ACTIVE" });
    await assert.rejects(resolveSummaryShare(token));
    const changed = await savePet(
      owner.id,
      {
        name: p.name,
        species: "DOG",
        careType: "INHOUSE",
        normalLocation: "Old location",
      },
      p.id,
    );
    assert.equal(changed.normalLocation, null);
  } finally {
    await db.auditLog.deleteMany({ where: { petId: p.id } });
    await db.pet.delete({ where: { id: p.id } });
    await db.$disconnect();
  }
});
