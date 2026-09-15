import "dotenv/config";
import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
const origin = "http://127.0.0.1:3000";
test("owner journey, image privacy, public allowlist and mobile layouts", async ({
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
  await page.waitForFunction(() =>
    Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
  );
  await page.screenshot({ path: ".local/qa/home-desktop.png", fullPage: true });
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app");
    await expect(
      page.getByRole("heading", { name: "Hello, Sarah." }),
    ).toBeVisible();
    await page.waitForFunction(() =>
      Array.from(document.images).every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `.local/qa/home-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/pets/new");
  await page.getByLabel("Pet’s name").fill("Pip QA");
  await page.getByRole("button", { name: "Add my pet" }).click();
  await expect(page.getByRole("heading", { name: "Pip QA." })).toBeVisible();
  const id = page.url().split("/").pop()!;
  const privatePet = await (await page.request.get(`/api/pets/${id}`)).json();
  expect((await request.get(`/api/pets/${id}`)).status()).toBe(401);
  expect((await request.get(`/p/${privatePet.publicId}`)).status()).toBe(404);
  const other = await browser.newContext();
  const login = await other.request.post("/api/auth/sign-in/email", {
    headers: { origin },
    data: { email: "james@petish.test", password: process.env.DEMO_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  expect((await other.request.get(`/api/pets/${id}`)).status()).toBe(404);
  expect(
    (
      await other.request.patch(`/api/pets/${id}`, {
        headers: { origin },
        data: { name: "Forbidden", species: "CAT" },
      })
    ).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Add a photo", exact: true }).click();
  await page
    .locator("dialog input[type=file]")
    .last()
    .setInputFiles(path.join(process.cwd(), "public/demo/tabby-kitten.jpg"));
  await expect(page.locator(".photo-tile")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const updated = await (await page.request.get(`/api/pets/${id}`)).json();
  const imageId = updated.mainImageId;
  expect((await request.get(`/api/images/${imageId}`)).status()).toBe(404);
  expect((await other.request.get(`/api/images/${imageId}`)).status()).toBe(
    404,
  );
  await page.getByRole("link", { name: "Edit profile" }).click();
  await page.getByLabel("Microchip").fill("QA-SECRET-CHIP");
  await page
    .getByLabel("A little introduction")
    .fill("A friendly cat with a very private microchip.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByRole("button", { name: "Visibility", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("QA-SECRET-CHIP");
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const publicResponse = await request.get(`/p/${privatePet.publicId}`);
  expect(publicResponse.status()).toBe(200);
  const html = await publicResponse.text();
  expect(html).not.toContain("QA-SECRET-CHIP");
  expect(html).not.toContain("sarah@petish.test");
  expect((await request.get(`/api/images/${imageId}?public=1`)).status()).toBe(
    200,
  );
  await page.screenshot({ path: ".local/qa/pet-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Visibility", exact: true }).click();
  await page.getByRole("button", { name: "Make private", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await request.get(`/p/${privatePet.publicId}`)).status()).toBe(404);
  expect((await request.get(`/api/images/${imageId}?public=1`)).status()).toBe(
    404,
  );
  await page.getByRole("button", { name: "Pet settings" }).click();
  await page.getByRole("button", { name: "Archive this pet" }).click();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pet settings" }).click();
  await page.getByRole("button", { name: "Restore to active pets" }).click();
  await page.goto("/app/pets/new");
  await expect(
    page.getByRole("heading", { name: "Who’s joining the family?" }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: ".local/qa/form-200-percent.png",
    fullPage: true,
  });
  await page.goto("/app/profile");
  const cookies = await page.context().cookies();
  const oldCookie = cookies.map((c) => `${c.name}=${c.value}`).join(";");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(
    (
      await request.get("/api/pets", { headers: { cookie: oldCookie } })
    ).status(),
  ).toBe(401);
  await other.close();
});
test("register, verify email, recover password and sign in", async ({
  page,
  request,
}) => {
  const email = `qa-${Date.now()}@petish.test`;
  await page.goto("/login?mode=signup");
  await page.getByLabel("Your name").fill("Test Parent");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Testing-Petish-2026!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  const messages = await (await request.get("/api/local-mail")).json();
  const mail = messages.find((m: { to: string }) => m.to === email);
  expect(mail).toBeTruthy();
  await page.goto(mail.url);
  await expect(page).toHaveURL(/\/app/);
  await expect(
    page.getByRole("heading", { name: "Hello, Test." }),
  ).toBeVisible();
  await page.goto("/app/profile");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "If that account exists",
  );
  const recovery = await (await request.get("/api/local-mail")).json();
  const reset = recovery.find(
    (m: { to: string; subject: string }) =>
      m.to === email && m.subject.startsWith("Reset"),
  );
  await page.goto(reset.url);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Recovered-Petish-2026!");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your password has been changed",
  );
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Recovered-Petish-2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app/);
});
