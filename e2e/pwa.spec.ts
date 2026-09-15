import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { db } from "../src/lib/db";
test("install metadata, icon assets, guide and private-data-free offline fallback", async ({
  page,
  context,
}) => {
  await mkdir(".local/qa", { recursive: true });
  await page.goto("/install");
  await expect(
    page.getByRole("heading", { name: "On your home screen.", exact: false }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.start_url).toBe("/app");
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  expect(manifest.icons).toHaveLength(3);
  for (const icon of manifest.icons) {
    const res = await page.request.get(icon.src);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("image/png");
  }
  expect(await page.locator('link[rel="apple-touch-icon"]').count()).toBe(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".local/qa/pwa-install-mobile.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const entries = await page.evaluate(async () => {
    const all = [];
    for (const key of await caches.keys())
      for (const req of await (await caches.open(key)).keys())
        all.push(new URL(req.url).pathname);
    return all;
  });
  expect(entries).toEqual(["/offline.html"]);
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Sarah." }),
  ).toBeVisible();
  const response = await page.request.post("/api/pets", {
    headers: { origin: "http://127.0.0.1:3000" },
    data: { name: "PWA offline fixture", species: "CAT" },
  });
  const pet = await response.json();
  expect(response.ok()).toBeTruthy();
  try {
    await page.goto(`/app/pets/${pet.id}/health/new?kind=NOTE`);
    await page
      .getByLabel("A short title", { exact: false })
      .fill("Unsaved private draft");
    await context.setOffline(true);
    await expect(
      page.getByText("Connection lost", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save record", exact: true })
      .click();
    await expect(page.locator(".error[role=alert]")).toContainText(
      "Could not reach Petish",
    );
    await expect(
      page.getByLabel("A short title", { exact: false }),
    ).toHaveValue("Unsaved private draft");
    await page.goto(`/app/pets/${pet.id}/health`);
    await expect(
      page.getByRole("heading", { name: "A little pause.", exact: false }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "Unsaved private draft",
    );
    await expect(page.locator("body")).not.toContainText("PWA offline fixture");
    const keys = await page.evaluate(async () => {
      const values = [];
      for (const name of await caches.keys())
        for (const req of await (await caches.open(name)).keys())
          values.push(new URL(req.url).pathname);
      return values;
    });
    expect(keys).toEqual(["/offline.html"]);
    await page.screenshot({
      path: ".local/qa/pwa-offline-mobile.png",
      fullPage: true,
    });
    await context.setOffline(false);
    await page.getByRole("link", { name: "Try Petish again" }).click();
    await expect(
      page.getByRole("heading", { name: "Hello, Sarah." }),
    ).toBeVisible();
    expect(await db.healthRecord.count({ where: { petId: pet.id } })).toBe(0);
  } finally {
    await context.setOffline(false);
    await db.auditLog.deleteMany({ where: { petId: pet.id } });
    await db.pet.delete({ where: { id: pet.id } });
    await db.$disconnect();
  }
});
