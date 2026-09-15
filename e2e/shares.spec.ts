import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../src/lib/db";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("owner previews selected snapshot, recipient opens without account, and revocation removes access", async ({
  page,
  browser,
  request,
}) => {
  const origin = "http://127.0.0.1:3000",
    headers = { origin };
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Sarah." }),
  ).toBeVisible();
  const pet = await (
    await page.request.post("/api/pets", {
      headers,
      data: {
        name: "Sharing browser fixture",
        species: "DOG",
        microchip: "EXCLUDED-BROWSER-CODE",
      },
    })
  ).json();
  const base = `/app/pets/${pet.id}/health`,
    api = `/api/shares/${pet.id}`;
  const visitor = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    recipient = await visitor.newPage();
  const other = await browser.newContext();
  try {
    const record = await (
      await page.request.post(`/api/health/${pet.id}`, {
        headers,
        data: {
          kind: "MEDICATION",
          title: "Fictional tablet",
          instructions: "Frozen instructions only",
          status: "ACTIVE",
        },
      })
    ).json();
    await page.goto(base + "/shares/new");
    await expect(
      page.getByLabel("Owner name", { exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByLabel("Microchip", { exact: true }),
    ).not.toBeChecked();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "Preview snapshot", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Review exactly what will be shared" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Link expiry", exact: true }),
    ).toHaveValue("DAY");
    await expect(page.locator(".summary-snapshot")).not.toContainText(
      "EXCLUDED-BROWSER-CODE",
    );
    await expect(page.locator(".summary-snapshot")).not.toContainText(
      "Sarah Chen",
    );
    await page.request.patch(`/api/health/${pet.id}/${record.id}`, {
      headers,
      data: {
        kind: "MEDICATION",
        title: "Fictional tablet",
        instructions: "Changed after preview",
        status: "ACTIVE",
        version: record.version,
      },
    });
    await page
      .getByLabel("I reviewed this snapshot.", { exact: false })
      .check();
    await page
      .getByRole("button", { name: "Create protected link", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Ready to share." }),
    ).toBeVisible();
    const url = await page
      .getByLabel("Protected link", { exact: true })
      .inputValue();
    expect(new URL(url).hash.length > 40).toBeTruthy();
    await expect(
      page.getByRole("img", {
        name: "QR code for this protected health-summary link",
      }),
    ).toBeVisible();
    // Disable clipboard in this test so the selectable-link fallback is exercised.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Unavailable");
          },
        },
      });
    });
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Select and copy" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (const width of [360, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    const navigation = await recipient.goto(url);
    expect(navigation!.headers()["referrer-policy"]).toBe("no-referrer");
    expect(navigation!.headers()["x-robots-tag"]).toContain("noindex");
    expect(navigation!.headers()["cache-control"]).toMatch(/no-store|no-cache/);
    const payloadCheck = await visitor.request.post("/api/shared-summary", {
      headers,
      data: { token: new URL(url).hash.slice(1) },
    });
    expect(payloadCheck.headers()["cache-control"]).toContain("no-store");
    await expect(
      recipient.getByText("Frozen instructions only", { exact: true }),
    ).toBeVisible();
    await expect(recipient.locator("body")).not.toContainText(
      "Changed after preview",
    );
    await expect(recipient.locator("body")).not.toContainText(
      "EXCLUDED-BROWSER-CODE",
    );
    expect(
      (await new AxeBuilder({ page: recipient }).analyze()).violations,
    ).toEqual([]);
    expect((await request.get(api)).status()).toBe(401);
    expect((await visitor.request.get(`/api/health/${pet.id}`)).status()).toBe(
      401,
    );
    const rows = await (await page.request.get(api)).json();
    expect(rows.shares.length).toBe(1);
    const id = rows.shares[0].id;
    await other.request.post("/api/auth/sign-in/email", {
      headers,
      data: { email: "james@petish.test", password: process.env.DEMO_PASSWORD },
    });
    expect((await other.request.get(api)).status()).toBe(404);
    expect(
      (await other.request.delete(`${api}/${id}`, { headers })).status(),
    ).toBe(404);
    await page.goto(base + "/shares");
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Revoke link", exact: true })
      .click();
    await expect(page.getByText("Revoked", { exact: true })).toBeVisible();
    await recipient.reload();
    await expect(
      recipient.getByRole("status").filter({ hasText: "unavailable" }),
    ).toBeVisible();
    await expect(recipient.locator("body")).not.toContainText(
      "Frozen instructions only",
    );
    expect(
      (await new AxeBuilder({ page: recipient }).analyze()).violations,
    ).toEqual([]);
    const expired = await visitor.request.post("/api/shared-summary", {
      headers,
      data: { token: new URL(url).hash.slice(1) },
    });
    expect(expired.status()).toBe(404);
    await recipient.goto(origin + "/shared");
    await expect(
      recipient.getByRole("status").filter({ hasText: "complete link" }),
    ).toBeVisible();
    await page.screenshot({
      path: ".local/qa/phase3-revoked-links.png",
      fullPage: true,
    });
  } finally {
    await visitor.close();
    await other.close();
    await db.auditLog.deleteMany({ where: { petId: pet.id } });
    await db.pet.delete({ where: { id: pet.id } });
    await db.$disconnect();
  }
});
