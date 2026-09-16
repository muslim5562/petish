import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../src/lib/db";
test.use({ trace: "off", screenshot: "off", video: "off" });
test("selected summary PDF download, file sharing, cancellation and fallback", async ({
  page,
}) => {
  const headers = { origin: "http://127.0.0.1:3000" };
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
        name: "PDF sample pet",
        species: "CAT",
        microchip: "PRIVATE-CODE-NOT-FOR-PDF",
      },
    })
  ).json();
  try {
    const medication = await page.request.post(`/api/health/${pet.id}`, {
      headers,
      data: {
        kind: "MEDICATION",
        title: "Fictional medication example",
        status: "ACTIVE",
        instructions: "Sample instructions for layout verification. ".repeat(
          40,
        ),
      },
    });
    expect(medication.status()).toBe(201);
    await page.goto(`/app/pets/${pet.id}/health/shares/new`);
    await page
      .getByRole("button", { name: "Preview snapshot", exact: true })
      .click();
    const area = page.getByRole("region", { name: "PDF sharing" });
    await expect(
      area.getByRole("button", { name: "Prepare PDF" }),
    ).toBeDisabled();
    await area.getByRole("checkbox").check();
    await area.getByRole("button", { name: "Prepare PDF" }).click();
    await expect(area.getByRole("link", { name: "Download PDF" })).toBeVisible({
      timeout: 30000,
    });
    const downloading = page.waitForEvent("download");
    await area.getByRole("link", { name: "Download PDF" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe("petish-health-summary.pdf");
    await download.saveAs(".local/qa/summary-export.pdf");
    const pdf = await PDFDocument.load(
      await readFile(".local/qa/summary-export.pdf"),
    );
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe("Petish health summary");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => false,
      });
    });
    await area.getByRole("button", { name: "Share PDF…", exact: true }).click();
    await expect(area.getByRole("status")).toContainText(
      "attach it as a document",
    );
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          if (
            data.files?.length !== 1 ||
            data.files[0].type !== "application/pdf"
          )
            throw new Error("Incorrect file");
          (window as unknown as { pdfShared: boolean }).pdfShared = true;
        },
      });
    });
    await area.getByRole("button", { name: "Share PDF…", exact: true }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { pdfShared: boolean }).pdfShared,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          throw new DOMException("Cancelled", "AbortError");
        },
      });
    });
    await area.getByRole("button", { name: "Share PDF…", exact: true }).click();
    await expect(area.getByRole("status")).toContainText("cancelled");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      (await (await page.request.get(`/api/shares/${pet.id}`)).json()).shares,
    ).toHaveLength(0);
    await page.getByRole("button", { name: "Change included details" }).click();
    await page
      .getByRole("button", { name: "Preview snapshot", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "PDF sharing" })
        .getByRole("button", { name: "Prepare PDF" }),
    ).toBeDisabled();
  } finally {
    await db.auditLog.deleteMany({ where: { petId: pet.id } });
    await db.pet.delete({ where: { id: pet.id } });
    await db.$disconnect();
  }
});
