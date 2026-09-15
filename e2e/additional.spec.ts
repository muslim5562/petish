import "dotenv/config";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:3000";
test("photo replacement and selection, deletion reauthentication, and private caching", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Sarah." }),
  ).toBeVisible();
  const create = await page.request.post("/api/pets", {
    headers: { origin },
    data: { name: "Photo QA", species: "CAT" },
  });
  expect(create.status()).toBe(201);
  const pet = await create.json();
  const buffer = await readFile("public/demo/tabby-kitten.jpg");
  const images = [];
  for (let i = 0; i < 3; i++) {
    const res = await page.request.post(`/api/pets/${pet.id}/photos`, {
      headers: { origin },
      multipart: {
        file: { name: "kitten.jpg", mimeType: "image/jpeg", buffer },
        view: "FRONT",
      },
    });
    expect(res.status()).toBe(201);
    images.push(await res.json());
  }
  const fourth = await page.request.post(`/api/pets/${pet.id}/photos`, {
    headers: { origin },
    multipart: { file: { name: "kitten.jpg", mimeType: "image/jpeg", buffer } },
  });
  expect(fourth.status()).toBe(400);
  await page.goto(`/app/pets/${pet.id}`);
  await page.getByRole("button", { name: "Edit photos" }).click();
  await expect(page.locator(".photo-tile")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Choose from library" }),
  ).toHaveCount(0);
  await page
    .locator(".photo-tile")
    .nth(1)
    .getByRole("button", { name: "Make main" })
    .click();
  await expect(page.locator(".photo-tile").nth(1)).toContainText("Main");
  const replaced = await page.request.post(`/api/pets/${pet.id}/photos`, {
    headers: { origin },
    multipart: {
      file: { name: "kitten.jpg", mimeType: "image/jpeg", buffer },
      replaceId: images[1].id,
    },
  });
  expect(replaced.status()).toBe(201);
  const replacement = await replaced.json();
  expect((await page.request.get(`/api/images/${images[1].id}`)).status()).toBe(
    404,
  );
  await page.reload();
  await page.getByRole("button", { name: "Edit photos" }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .locator(".photo-tile")
    .last()
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.locator(".photo-tile")).toHaveCount(2);
  expect(
    (await page.request.get(`/api/images/${replacement.id}`)).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Visibility", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const info = await (await page.request.get(`/api/pets/${pet.id}`)).json();
  const publicImage = await request.get(
    `/api/images/${info.mainImageId}?public=1`,
  );
  expect(publicImage.headers()["cache-control"]).toContain("no-store");
  expect(
    (
      await page.request.patch(`/api/pets/${pet.id}/state`, {
        headers: { origin: "https://untrusted.example" },
        data: { visibility: "PUBLIC", confirmed: true },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/app/profile");
  await page
    .getByRole("button", { name: "Request account deletion", exact: true })
    .click();
  await page.getByLabel("Current password").fill("incorrect-password");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByLabel("Current password").fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(
    page.getByRole("heading", { name: "Deletion request received" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel deletion request", exact: true })
    .click();
  await page.getByLabel("Current password").fill(process.env.DEMO_PASSWORD!);
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Need to close your account?" }),
  ).toBeVisible();
});
