import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { readFile, readdir, unlink } from "node:fs/promises";
import { db } from "../src/lib/db";
import { deleteObject } from "../src/lib/storage";
test.use({ actionTimeout: 15000, trace: "off", screenshot: "off" });
test("public board, guest verification, private sighting, and owner closure on desktop and phone", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const tag = randomUUID();
  const email = `browser-board-${tag}@example.test`;
  const headers = { origin: "http://127.0.0.1:3000" };
  const reports: string[] = [];
  let petId: string | undefined;
  const guestContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
  });
  const guest = await guestContext.newPage();
  async function link(suffix: string) {
    for (const f of (await readdir(".local/mail")).sort().reverse()) {
      const m = JSON.parse(await readFile(`.local/mail/${f}`, "utf8"));
      if (m.to === email && new URL(m.url).pathname.endsWith(suffix))
        return m.url as string;
    }
    throw Error("Verification email not captured");
  }
  try {
    await page.goto("/login");
    await page
      .getByRole("button", { name: "Explore the demo", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Hello, Sarah." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Lost & Found" }),
    ).toBeVisible();
    const p = await page.request.post("/api/pets", {
      headers,
      data: {
        name: "Neighbourhood Luna",
        species: "CAT",
        careType: "CARE_STRAY",
        normalLocation: "Private feeding corner",
        microchip: "PRIVATE CHIP",
      },
    });
    expect(p.status()).toBe(201);
    petId = (await p.json()).id;
    await page.goto(`/app/pets/${petId}`);
    await page.getByRole("link", { name: "Report missing" }).click();
    await expect(page.getByLabel("Pet name", { exact: true })).toHaveValue(
      "Neighbourhood Luna",
    );
    await page.getByLabel("Last seen locality").fill("Taman Petish Test");
    await page
      .getByLabel("Details and identifying features")
      .fill("Fictional gentle cat with a white patch on her chest.");
    await page.getByLabel("Contact number", { exact: true }).fill("0123456789");
    await page
      .getByLabel("Show my contact number publicly on this report")
      .check();
    await page.getByLabel("Possible reward").fill("Reward offered");
    await page
      .getByLabel("Upload photos")
      .setInputFiles("public/demo/golden-retriever.jpg");
    await page.getByRole("button", { name: "Preview public report" }).click();
    await expect(
      page.getByRole("heading", { name: "Review your public report." }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(
      "Private feeding corner",
    );
    await page.getByLabel(/I reviewed these public details/).check();
    await page
      .getByRole("button", { name: "Publish report", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your report is on the board." }),
    ).toBeVisible();
    const href = await page
      .getByRole("link", { name: "View report", exact: true })
      .getAttribute("href");
    const missingId = href!.split("/").at(-1)!;
    reports.push(missingId);
    await page.getByRole("link", { name: "View report", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Neighbourhood Luna is missing" }),
    ).toBeVisible();
    const projection = await (
      await guest.request.get(`/api/lost-found/${missingId}`)
    ).json();
    expect(JSON.stringify(projection)).not.toContain("PRIVATE CHIP");
    expect(projection.phone).toBe("0123456789");
    expect(
      (
        await guest.request.post("/api/lost-found/manage", {
          headers,
          data: { id: missingId },
        })
      ).status(),
    ).toBe(404);
    expect(
      (await guest.request.get("/api/lost-found/moderation")).status(),
    ).toBe(403);
    expect(
      (
        await guest.request.post("/api/lost-found/flag", {
          headers: { origin: "https://untrusted.invalid" },
          data: { id: missingId, reason: "Test concern" },
        })
      ).status(),
    ).toBe(403);
    await guest.goto(`/lost-found/${missingId}`);
    await guest
      .getByRole("button", { name: /seen|found|sighting/i })
      .first()
      .click();
    await guest.getByLabel(/Your email/).fill(email);
    await guest
      .getByLabel("Where was the pet seen / found?")
      .fill("Test park entrance");
    await guest.getByLabel("When was it seen / found?").fill("2026-09-01");
    await guest
      .getByLabel("Details of the possible sighting")
      .fill("Fictional sighting near the park gate.");
    await guest
      .getByLabel("Photos of the pet you saw")
      .setInputFiles("public/demo/golden-retriever.jpg");
    await guest.getByLabel(/I have permission to share/).check();
    await guest.getByRole("button", { name: "Send private response" }).click();
    await expect(guest.getByRole("status")).toContainText("Check your email");
    await guest.goto(await link("/verify"));
    await guest
      .getByRole("button", { name: "Verify and send response" })
      .click();
    await expect(guest.getByRole("status")).toContainText("Response verified");
    await page.goto(`/lost-found/manage?id=${missingId}`);
    await expect(
      page.getByText("Fictional sighting near the park gate."),
    ).toBeVisible();
    await expect(page.getByAltText("Private response photo")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: ".local/qa/lost-found-manager.png",
      fullPage: true,
    });
    await guest.goto("/lost-found/new?kind=FOUND");
    await guest.getByLabel(/Your email/).fill(email);
    await guest.getByLabel("Pet name").fill("Friendly wanderer");
    await guest.getByRole("combobox", { name: /^Species/ }).selectOption("DOG");
    await guest.getByLabel("Found / seen locality").fill("Taman Petish Test");
    await guest
      .getByLabel("Details and identifying features")
      .fill("Fictional dog resting safely at the neighbourhood shelter.");
    await guest
      .getByLabel("Upload photos")
      .setInputFiles("public/demo/golden-retriever.jpg");
    await guest.getByRole("button", { name: "Preview public report" }).click();
    await guest.getByLabel(/I reviewed these public details/).check();
    const created = guest.waitForResponse(
      (r) =>
        r.url().endsWith("/api/lost-found") && r.request().method() === "POST",
    );
    await guest.getByRole("button", { name: "Save and verify email" }).click();
    const foundResponse = await created;
    expect(foundResponse.status()).toBe(201);
    const foundId = (await foundResponse.json()).id;
    reports.push(foundId);
    await expect(
      guest.getByRole("heading", { name: "Check your email." }),
    ).toBeVisible();
    expect(
      (await guest.request.get(`/api/lost-found/${foundId}`)).status(),
    ).toBe(404);
    await guest.goto(await link("/manage"));
    await guest.getByRole("button", { name: /Verify.*publish/i }).click();
    await expect(guest.getByRole("status")).toContainText("Report updated");
    await guest.goto("/lost-found");
    await expect(
      guest.getByRole("heading", { name: "Found dog · Friendly wanderer" }),
    ).toBeVisible();
    await expect(
      guest.getByRole("heading", { name: "Neighbourhood Luna is missing" }),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page: guest }).analyze()).violations,
    ).toEqual([]);
    await guest.screenshot({
      path: ".local/qa/lost-found-desktop.png",
      fullPage: true,
    });
    await guest
      .getByRole("combobox", { name: /^Reports/ })
      .selectOption("FOUND");
    await guest.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      guest.getByRole("heading", { name: "Neighbourhood Luna is missing" }),
    ).toHaveCount(0);
    await guest.setViewportSize({ width: 390, height: 844 });
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page: guest }).analyze()).violations,
    ).toEqual([]);
    await guest.screenshot({
      path: ".local/qa/lost-found-phone.png",
      fullPage: true,
    });
    await guest.goto(`/lost-found/${foundId}`);
    await expect(
      guest.getByRole("heading", { name: "Found dog · Friendly wanderer" }),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page: guest }).analyze()).violations,
    ).toEqual([]);
    await guest.screenshot({
      path: ".local/qa/lost-found-detail-phone.png",
      fullPage: true,
    });
    await page.goto(`/app/pets/${petId}`);
    await expect(
      page.getByRole("link", { name: "Manage missing report" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Manage missing report" }).click();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Close case and retain history" })
      .click();
    await expect(
      page.getByText("Closed: reunited", { exact: true }),
    ).toBeVisible();
    expect(
      (await guest.request.get(`/api/lost-found/${missingId}`)).status(),
    ).toBe(404);
    expect((await guest.request.get(projection.photos[0].url)).status()).toBe(
      404,
    );
    await page.goto("/lost-found/manage");
    await expect(
      page.getByRole("heading", { name: "Neighbourhood Luna is missing" }),
    ).toBeVisible();
  } finally {
    await guestContext.close();
    // Include only this test's exact known pet/email if an assertion interrupted ID collection.
    const created = await db.boardReport.findMany({
      where: { OR: [{ email }, ...(petId ? [{ petId }] : [])] },
      select: { id: true },
    });
    const ids = [...new Set([...reports, ...created.map((r) => r.id)])];
    for (const p of await db.boardPhoto.findMany({
      where: { reportId: { in: ids } },
    })) {
      await deleteObject(p.objectKey);
      await deleteObject(p.thumbKey);
    }
    await db.boardNotification.deleteMany({ where: { reportId: { in: ids } } });
    await db.boardReport.deleteMany({ where: { id: { in: ids } } });
    if (petId) {
      await db.auditLog.deleteMany({ where: { petId } });
      await db.pet.delete({ where: { id: petId } });
    }
    for (const f of await readdir(".local/mail")) {
      const m = JSON.parse(await readFile(`.local/mail/${f}`, "utf8"));
      if (m.to === email) await unlink(`.local/mail/${f}`);
    }
  }
});
