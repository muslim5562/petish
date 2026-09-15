import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
await mkdir(".local/qa", { recursive: true });
await page.goto("http://127.0.0.1:3000/login");
await page.getByRole("button", { name: "Explore the demo" }).click();
await page.getByRole("heading", { name: "Hello, Sarah." }).waitFor();
const reports = [];
const pets = await (await page.request.get("http://127.0.0.1:3000/api/pets")).json();
const main = pets.find((p) => p.name === "Milo");
for (const [route, width] of [
  ["/app", 1280],
  ["/app/pets/new", 390],
  ["/app/profile", 390],
  ["/", 390],
  ["/login", 390],
  [`/app/pets/${main.id}`, 390],
  [`/app/pets/${main.id}/edit`, 390],
  [`/p/${main.publicId}`, 390],
]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("http://127.0.0.1:3000" + route);
  await page.waitForSelector(".loading", { state: "detached" });
  await page.waitForFunction(() =>
    Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  reports.push({ route, width, violations: results.violations });
  console.log(
    JSON.stringify({
      route,
      width,
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes
          .map((n) => ({ target: n.target, summary: n.failureSummary }))
          .slice(0, 15),
      })),
    }),
  );
}
await writeFile(
  ".local/qa/accessibility.json",
  JSON.stringify(reports, null, 2),
);
await browser.close();

