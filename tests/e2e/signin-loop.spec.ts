import { test, expect } from "@playwright/test";
import fs from "node:fs";

/* Regression: signing in from /signin minted a link whose callbackUrl was
   /signin itself. It signed you in and dropped you back on the sign-in form,
   which never checked for a session — so it looked like the link had failed,
   you asked for another, and round it went. */

function latestSignInUrl(email: string): string {
  const lines = fs.readFileSync("var/outbox/mail.jsonl", "utf8").trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = JSON.parse(lines[i]);
    if (m.to === email && m.signInUrl) return m.signInUrl;
  }
  throw new Error(`no sign-in link for ${email}`);
}

async function requestLink(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.fill("input[name=email]", email);
  await page.click("button[type=submit]");
  await expect(page.getByText(/on its way/i)).toBeVisible();
  return latestSignInUrl(email);
}

test("a magic link from /signin lands on the dashboard, not back on the form", async ({ page }) => {
  const url = await requestLink(page, "couple@example.com");

  // the link itself must not point back at the sign-in page
  expect(new URL(url).searchParams.get("callbackUrl")).not.toContain("/signin");

  await page.goto(url);
  await expect(page).toHaveURL(/\/couple/);
  await expect(page.locator("input[name=email]")).toHaveCount(0);
});

test("/signin sends an already-signed-in visitor to their dashboard", async ({ page }) => {
  await page.goto(await requestLink(page, "couple@example.com"));
  await expect(page).toHaveURL(/\/couple/);

  await page.goto("/signin");
  await expect(page).toHaveURL(/\/couple/);
});

test("re-opening a used link explains itself instead of a bare 403", async ({ page, context }) => {
  const url = await requestLink(page, "admin@example.com");
  await page.goto(url);
  await expect(page).toHaveURL(/\/admin/);

  // a second visit, as a different visitor (no session) — the token is spent
  await context.clearCookies();
  await page.goto(url);
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByText(/already been used, or it expired/i)).toBeVisible();
  await expect(page.locator("input[name=email]")).toBeVisible();
});
