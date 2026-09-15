import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { db } from "../src/lib/db";
import { deleteObject } from "../src/lib/storage";
const origin = "http://127.0.0.1:3000",
  headers = { origin };
test("Phase 2 entry journey, private attachments, history, summary and responsive accessibility", async ({
  page,
  request,
  browser,
}) => {
  await mkdir(".local/qa", { recursive: true });
  await page.goto("/login");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Sarah." }),
  ).toBeVisible();
  const response = await page.request.post("/api/pets", {
    headers,
    data: { name: "Phase2 browser fixture", species: "DOG" },
  });
  expect(response.ok()).toBeTruthy();
  const pet = await response.json();
  const base = `/app/pets/${pet.id}/health`,
    api = `/api/health/${pet.id}`;
  const other = await browser.newContext();
  try {
    const login = await other.request.post("/api/auth/sign-in/email", {
      headers,
      data: { email: "james@petish.test", password: process.env.DEMO_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    expect((await request.get(api)).status()).toBe(401);
    expect((await other.request.get(api)).status()).toBe(404);
    expect(
      (
        await page.request.post(api, {
          data: { kind: "NOTE", title: "No origin" },
        })
      ).status(),
    ).toBe(403);
    const choices = [
      ["VISIT", "Reason for the visit"],
      ["MEDICATION", "Medication name or description"],
      ["VACCINATION", "Vaccination name"],
      ["PROBLEM", "Problem or concern"],
      ["ALLERGY", "Allergen or suspected trigger"],
      ["PROCEDURE", "Procedure name"],
      ["DOCUMENT", "Document title"],
      ["NOTE", "A short title"],
    ];
    let visitId = "",
      fileId = "",
      medId = "";
    for (const [kind, label] of choices) {
      await page.goto(`${base}/new?kind=${kind}`);
      await page.getByLabel(label, { exact: false }).fill(`QA ${kind}`);
      if (kind === "MEDICATION") {
        await page.getByLabel("Date information").selectOption("UNKNOWN");
        await page.getByText("Source and visit", { exact: false }).click();
        await page.getByLabel("Related vet visit").selectOption(visitId);
        await page
          .getByLabel("Choose files", { exact: false })
          .setInputFiles("public/demo/tabby-kitten.jpg");
      }
      await page
        .getByRole("button", { name: "Save record", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: `QA ${kind}`, exact: true }),
      ).toBeVisible();
      const recordId = page.url().split("/").pop()!;
      if (kind === "VISIT") visitId = recordId;
      if (kind === "MEDICATION") {
        medId = recordId;
        const r = await (await page.request.get(`${api}/${recordId}`)).json();
        expect(r.occurredOn).toBeNull();
        expect(r.linkedEncounterId).toBe(visitId);
        fileId = r.attachments[0].id;
      }
    }
    expect((await request.get(`/api/health-files/${fileId}`)).status()).toBe(
      404,
    );
    expect(
      (await other.request.get(`/api/health-files/${fileId}`)).status(),
    ).toBe(404);
    expect(
      (await page.request.get(`/api/health-files/${fileId}`)).status(),
    ).toBe(200);
    expect(
      (await other.request.get(`${api}/${visitId}/revisions`)).status(),
    ).toBe(404);
    await page.goto(`${base}/${visitId}/edit`);
    await page
      .getByLabel("Outcome", { exact: false })
      .fill("Improved at follow-up");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByText("Improved at follow-up", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit history", exact: true })
      .click();
    await expect(
      page.getByText("Version 1 · Created record", { exact: false }),
    ).toBeVisible();
    const before = await (await page.request.get(`${api}/${medId}`)).json();
    const removed = await (
      await page.request.delete(`${api}/${medId}`, {
        headers,
        data: { version: before.version },
      })
    ).json();
    expect(
      (await page.request.get(`/api/health-files/${fileId}`)).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(`${api}/${medId}/restore`, {
          headers,
          data: { version: removed.version },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (await page.request.get(`/api/health-files/${fileId}`)).status(),
    ).toBe(200);
    await page.goto(base);
    await page
      .getByRole("button", { name: "Emergency notes & allergy knowledge" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByLabel("Emergency notes", { exact: false })
      .fill("Private QA emergency context");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "Save summary notes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    for (const route of [
      "",
      "/timeline",
      "/documents",
      "/summary",
      "/new?kind=VISIT",
    ]) {
      await page.goto(base + route);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Getting Phase2 browser fixture’s health record…", {
          exact: true,
        }),
      ).not.toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const width of [360, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
      }
    }
    await page.goto(`${base}/summary`);
    await page.getByRole("button", { name: "Show on screen" }).click();
    await expect(
      page.getByRole("button", { name: "Exit full-screen summary" }),
    ).toBeVisible();
    await expect(page.getByText("Private QA emergency context")).toBeVisible();
    await page
      .getByRole("button", { name: "Exit full-screen summary" })
      .click();
    const data = await (await page.request.get(api)).json();
    expect(data.records).toHaveLength(8);
    await page.locator("html").evaluate((el) => {
      el.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.locator("html").evaluate((el) => {
      el.style.fontSize = "";
    });
    expect(
      (
        await page.request.patch("/api/pets/" + pet.id + "/state", {
          headers,
          data: { visibility: "PUBLIC", confirmed: true },
        })
      ).ok(),
    ).toBeTruthy();
    const publicPage = await request.get("/p/" + pet.publicId);
    expect(publicPage.status()).toBe(200);
    expect(await publicPage.text()).not.toContain(
      "Private QA emergency context",
    );
    expect((await request.get(api)).status()).toBe(401);
    expect((await request.get("/api/health-files/" + fileId)).status()).toBe(
      404,
    );
    expect((await other.request.get(api)).status()).toBe(404);
    const f = await (await page.request.get(`${api}/${medId}`)).json();
    expect(
      (
        await page.request.delete(`${api}/${medId}/files/${fileId}`, {
          headers,
          data: { version: f.version },
        })
      ).ok(),
    ).toBeTruthy();
    expect(
      (await page.request.get(`/api/health-files/${fileId}`)).status(),
    ).toBe(404);
    const pets = await (await page.request.get("/api/pets")).json();
    const milo = (Array.isArray(pets) ? pets : pets.pets).find(
      (p: { name: string }) => p.name === "Milo",
    );
    await page.goto(`/app/pets/${milo.id}/health`);
    await expect(
      page.getByRole("heading", { name: "Milo’s health." }),
    ).toBeVisible();
    await page.screenshot({
      path: ".local/qa/phase2-overview-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/app/pets/${milo.id}/health/timeline`);
    await expect(
      page.getByText("Annual wellbeing visit — demo", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: ".local/qa/phase2-timeline-mobile.png",
      fullPage: true,
    });
  } finally {
    await other.close();
    const files = await db.attachment.findMany({
      where: { record: { petId: pet.id } },
    });
    for (const f of files) {
      await deleteObject(f.objectKey);
      if (f.thumbKey) await deleteObject(f.thumbKey);
    }
    await db.auditLog.deleteMany({ where: { petId: pet.id } });
    await db.pet.delete({ where: { id: pet.id } });
    await db.$disconnect();
  }
});
