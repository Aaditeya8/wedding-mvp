import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("guest RSVPs via emailed link; public site renders", async ({ page }) => {
  const out = fs.readFileSync("var/e2e-seed.txt", "utf8");
  // "The Khans" is seed index 7 — outside the first 7 families that get
  // pre-seeded RSVPs, so this family starts un-responded (required for the
  // prefill assertion below).
  const url = out.split("\n").find((l) => l.startsWith("The Khans:"))!.split(": ")[1].trim();

  await page.goto(url);
  await expect(page.getByText(/Khan/i).first()).toBeVisible();
  await expect(page.getByText(/Sangeet/i).first()).toBeVisible();

  // RSVP attending to the first event (headcount prefilled = 2 members), decline the second
  const cards = page.getByTestId("event-card");
  await cards.nth(0).getByRole("button", { name: /attending/i }).click();
  await cards.nth(1).getByRole("button", { name: /decline/i }).click();
  await page.getByRole("button", { name: /send rsvp/i }).click();
  await expect(page.getByText(/see you/i)).toBeVisible();

  // Revisit link → previous answers prefilled
  await page.goto(url);
  await expect(cards.nth(0).getByRole("button", { name: /attending/i })).toHaveAttribute("aria-pressed", "true");
  await expect(cards.nth(1).getByRole("button", { name: /decline/i })).toHaveAttribute("aria-pressed", "true");

  // Public site renders themed sections
  await page.goto("/w/ananya-weds-arjun");
  await expect(page.getByText(/Ananya/i).first()).toBeVisible();
  await expect(page.getByText(/Reception/i).first()).toBeVisible();
});
