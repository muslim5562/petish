import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../src/lib/db";
test("care stray details, persistent home card, status and sidebar sign-out", async ({
  page,
}) => {
  const headers = { origin: "http://127.0.0.1:3000" };
  let id: string | undefined;
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Explore the demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Sarah." }),
  ).toBeVisible();
  try {
    const invalid = await page.request.post("/api/pets", {
      headers,
      data: { name: "Care test", species: "CAT", careType: "CARE_STRAY" },
    });
    expect(invalid.status()).toBe(400);
    const response = await page.request.post("/api/pets", {
      headers,
      data: {
        name: "Care stray fixture",
        species: "CAT",
        careType: "CARE_STRAY",
        normalLocation: "Private feeding corner",
      },
    });
    expect(response.status()).toBe(201);
    id = (await response.json()).id;
    await page.goto(`/app/pets/${id}/edit`);
    await expect(
      page.getByRole("combobox", { name: "Care arrangement" }),
    ).toHaveValue("CARE_STRAY");
    await expect(
      page.getByRole("textbox", { name: "Normal location" }),
    ).toHaveValue("Private feeding corner");
    await page.goto(`/app/pets/${id}`);
    await expect(
      page.getByText("Private feeding corner", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pet settings" }),
    ).toContainText("Status");
    const projection = await (
      await page.request.get(`/api/pets/${id}/preview`)
    ).json();
    expect(JSON.stringify(projection)).not.toContain("Private feeding corner");
    await page.goto("/app");
    await expect(
      page
        .getByRole("region", { name: "Care strays" })
        .locator(`a[href="/app/pets/${id}"]`),
    ).toBeVisible();
    await page.goto(`/app/pets/${id}`);
    await page.getByRole("button", { name: "Pet settings" }).click();
    await page
      .getByRole("textbox", { name: "New owner’s Petish email" })
      .fill("james@petish.test");
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: "Transfer to new owner", exact: true })
      .click();
    await expect(
      page.getByText("Transferred to new owner", { exact: true }),
    ).toBeVisible();
    await page.goto("/app");
    await expect(page.locator(`a[href="/app/pets/${id}"]`)).toHaveCount(0);
    await page.goto("/app/pets");
    await page.getByRole("button", { name: "Rehomed", exact: true }).click();
    await expect(page.locator(`a[href="/app/pets/${id}"]`)).toBeVisible();
    await page.locator(`a[href="/app/pets/${id}"]`).click();
    await expect(
      page.getByRole("link", { name: "Health record", exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: ".local/qa/care-details-desktop.png",
      fullPage: true,
    });
    await page.request.patch(`/api/pets/${id}/state`, {
      headers,
      data: { status: "DECEASED" },
    });
    await page.goto("/app");
    await expect(page.locator(`a[href="/app/pets/${id}"]`)).toHaveCount(0);
    await page.goto("/app/pets");
    await page.getByRole("button", { name: "Deceased", exact: true }).click();
    await expect(page.locator(`a[href="/app/pets/${id}"]`)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: ".local/qa/care-history-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login/);
  } finally {
    if (id) {
      await db.auditLog.deleteMany({ where: { petId: id } });
      await db.pet.delete({ where: { id } });
    }
    await db.$disconnect();
  }
});
