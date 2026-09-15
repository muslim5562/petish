import { test } from "node:test";
import assert from "node:assert/strict";
import {
  petInput,
  publicProjection,
  ageLabel,
  isPublicPet,
} from "../src/lib/pet-rules";
test("minimum registration preserves unknown demographic values", () => {
  const p = petInput.parse({ name: "Bean", species: "CAT" });
  assert.equal(p.sex, "UNKNOWN");
  assert.equal(p.birthPrecision, "UNKNOWN");
  assert.equal(p.breed, null);
});
test("rejects invalid, impossible and future birth dates", () => {
  for (const birthDate of ["2025-02-30", "2099-01-01", "invalid"])
    assert.equal(
      petInput.safeParse({
        name: "Bean",
        species: "CAT",
        birthPrecision: "EXACT",
        birthDate,
      }).success,
      false,
    );
});
test("never invents ages or birthdays", () => {
  assert.equal(ageLabel(null, "UNKNOWN"), "Age unknown");
  assert.equal(
    ageLabel("2023-01-01", "YEAR", new Date("2026-06-01")),
    "About 3 years",
  );
});
test("public projection is a strict allowlist, never a spread of private records", () => {
  const source = {
    publicId: "public-id",
    name: "Milo",
    species: "DOG",
    breed: null,
    sex: "MALE",
    birthDate: "2023-01-01",
    birthPrecision: "EXACT",
    area: "Maplewood",
    description: "Friendly",
    mainImageId: "image-id",
    ownerId: "secret-owner",
    microchip: "secret-chip",
    medicalNotes: "secret",
    email: "secret@example.test",
  };
  const projection = publicProjection(source);
  assert.deepEqual(Object.keys(projection), [
    "publicId",
    "name",
    "species",
    "breed",
    "sex",
    "age",
    "area",
    "description",
    "imageUrl",
  ]);
  for (const secret of [
    "secret-owner",
    "secret-chip",
    "secret@example.test",
    "2023-01-01",
  ])
    assert.equal(JSON.stringify(projection).includes(secret), false);
});
test("archived and memorial profiles cannot be public", () => {
  assert.equal(isPublicPet({ visibility: "PUBLIC", status: "ACTIVE" }), true);
  for (const status of ["ARCHIVED", "DECEASED"])
    assert.equal(isPublicPet({ visibility: "PUBLIC", status }), false);
});
