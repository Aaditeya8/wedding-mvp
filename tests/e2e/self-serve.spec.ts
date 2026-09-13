import { test, expect } from "@playwright/test";
import fs from "node:fs";

/** Latest magic link written to the outbox for this address. */
function signInUrl(email: string): string {
  const lines = fs.readFileSync("var/outbox/mail.jsonl", "utf8").trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = JSON.parse(lines[i]);
    if (m.to === email && m.signInUrl) return m.signInUrl;
  }
  throw new Error(`no sign-in link for ${email}`);
}

test("a couple signs up, edits their site, and a guest RSVPs from the shared link", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  // ── sign up ────────────────────────────────────────────────
  await page.goto("/start");
  await page.fill("input[name=brideName]", "Sanya");
  await page.fill("input[name=groomName]", "Kabir");
  await page.fill("input[name=weddingDate]", "2027-04-18");
  await page.fill("input[name=city]", "Udaipur");
  await page.fill("input[name=email]", email);
  await page.click("button[type=submit]");
  await expect(page.getByText(/check your inbox/i)).toBeVisible();

  // ── magic link lands in the editor ─────────────────────────
  await page.goto(signInUrl(email));
  await expect(page).toHaveURL(/\/couple\/site/);
  await expect(page.getByRole("heading", { name: /edit your invitation/i })).toBeVisible();
  // the five starter ceremonies exist
  await expect(page.getByText("5 events")).toBeVisible();

  // ── hide one event from the public site ────────────────────
  const haldi = page.locator("details", { has: page.locator("input[name=name][value=Haldi]") });
  await haldi.locator("summary").click();
  await haldi.getByRole("button", { name: /hide from site/i }).click();
  await expect(page.getByText(/1 hidden/)).toBeVisible();

  // ── the public site reflects it ────────────────────────────
  await page.goto("/w/sanya-weds-kabir");
  await expect(page.getByRole("heading", { name: "Mehendi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Haldi" })).toHaveCount(0);

  // ── a guest RSVPs from the shared link, no account ─────────
  await page.goto("/w/sanya-weds-kabir/rsvp");
  await page.fill("input[placeholder='The Mehtas / Priya Nair']", "The Kapoors");
  await page.fill("input[inputmode=tel]", "+91 98765 43210");
  const cards = page.getByTestId("event-card");
  await cards.nth(0).getByRole("button", { name: /^attending$/i }).click();
  await cards.nth(1).getByRole("button", { name: /can.t make it/i }).click();
  await page.getByRole("button", { name: /send rsvp/i }).click();
  await expect(page.getByText(/see you at the/i)).toBeVisible();

  // the edit link they were handed works and remembers the answers
  const editUrl = await page.locator("input[readonly]").inputValue();
  expect(editUrl).toContain("/rsvp/");
  await page.goto(editUrl);
  await expect(page.getByText(/The Kapoors/i).first()).toBeVisible();

  // ── and the couple sees the guest on their dashboard ───────
  await page.goto("/couple");
  await expect(page.getByText("The Kapoors")).toBeVisible();

  // the link the couple is told to share must point at the host they are on —
  // an APP_URL left pointing elsewhere would hand 300 guests a dead link
  const shareUrl = await page.locator("#share input[readonly]").inputValue();
  expect(shareUrl).toBe(new URL("/w/sanya-weds-kabir", page.url()).toString());
});

test("RSVPs can be switched off by the couple", async ({ page }) => {
  const email = `e2e-off-${Date.now()}@example.com`;
  await page.goto("/start");
  await page.fill("input[name=brideName]", "Riya");
  await page.fill("input[name=groomName]", "Veer");
  await page.fill("input[name=weddingDate]", "2027-06-06");
  await page.fill("input[name=city]", "Goa");
  await page.fill("input[name=email]", email);
  await page.click("button[type=submit]");
  // wait for the server action to finish before reading the outbox it writes
  await expect(page.getByText(/check your inbox/i)).toBeVisible();
  await page.goto(signInUrl(email));

  await page.fill("input[name=contactPhone]", "+91 90000 12345");
  await page.locator("#details button[type=submit]").click();
  await expect(page).toHaveURL(/saved=details/);

  await page.locator("#rsvp input[name=rsvpOpen]").uncheck();
  await page.locator("#rsvp button[type=submit]").click();
  await expect(page).toHaveURL(/saved=rsvp/);

  await page.goto("/w/riya-weds-veer/rsvp");
  await expect(page.getByRole("heading", { name: /rsvps are closed/i })).toBeVisible();
  await expect(page.getByText(/\+91 90000 12345/)).toBeVisible();
  await expect(page.getByRole("button", { name: /send rsvp/i })).toHaveCount(0);
});
