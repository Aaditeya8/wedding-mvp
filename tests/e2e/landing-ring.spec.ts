import { test, expect, type Page } from "@playwright/test";

/* The ring of six invitations on the landing page.
   Regressions: half the ring was invisible (rear cards hidden outright),
   the only way to close an opened card was a 32x18px link, and nothing
   happened on hover. */

async function settle(page: Page) {
  // the ring paints from a rAF loop; give it a couple of frames
  await page.waitForFunction(() => document.querySelectorAll(".wheel-item").length === 6);
  await page.waitForTimeout(120);
  // a pointer over the stage holds the ring still, as it does for a person
  const st = (await page.locator(".wheel-stage").boundingBox())!;
  await page.mouse.move(st.x + st.width / 2, st.y + 8);
  await page.waitForTimeout(150);
}

async function frontCover(page: Page) {
  return page.locator('.wheel-item[data-front="true"] .card3d-cover');
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await settle(page);
});

test("all six cards are on show: a face or a back plate, none faded to nothing", async ({ page }) => {
  const state = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".wheel-item")].map((it) => {
      const back = it.dataset.back === "true";
      const face = it.querySelector(".card3d") as HTMLElement;
      // a rear card shows its plate (::before); a front one shows its face
      const shown = back ? getComputedStyle(it, "::before") : getComputedStyle(face);
      return { visibility: getComputedStyle(it).visibility, shownVisibility: shown.visibility, opacity: parseFloat(shown.opacity) };
    }),
  );
  expect(state).toHaveLength(6);
  for (const s of state) {
    expect(s.visibility).toBe("visible");
    expect(s.shownVisibility).toBe("visible");
    expect(s.opacity).toBeGreaterThanOrEqual(0.35);
  }
});

test("the front card opens on tap and closes on a tap anywhere on the page, or Escape", async ({ page }) => {
  const cover = await frontCover(page);
  await cover.click({ force: true });
  const open = page.locator('.card3d[data-open="true"]');
  await expect(open).toHaveCount(1);
  await page.waitForTimeout(1000); // cover swing

  // tap the middle of the open page: no need to find a tiny link
  const box = (await open.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(open).toHaveCount(0);
  await page.waitForTimeout(1000); // cover swings shut before it takes the next tap

  await (await frontCover(page)).click({ force: true });
  await expect(open).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(open).toHaveCount(0);
});

test("the close control is a real target, not a hairline link", async ({ page }) => {
  await (await frontCover(page)).click({ force: true });
  await page.waitForTimeout(1000);
  const box = (await page.locator('.card3d[data-open="true"] .card3d-inner button').boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(26);
  expect(box.width).toBeGreaterThanOrEqual(60);
});

test("a card grows under the pointer", async ({ page }) => {
  const cover = await frontCover(page);
  const card = cover.locator("..");
  const scaleOf = () =>
    card.evaluate((el) => {
      const m = getComputedStyle(el).transform;
      if (m === "none") return 1;
      const v = m.replace(/matrix(3d)?\(/, "").split(",").map(Number);
      return v.length === 16 ? Math.hypot(v[0], v[1], v[2]) : Math.hypot(v[0], v[1]);
    });
  expect(await scaleOf()).toBeCloseTo(1, 2);
  await cover.hover({ force: true });
  await page.waitForTimeout(700);
  expect(await scaleOf()).toBeGreaterThan(1.03);
});

/* The inside page painted under every closed cover, and on a phone-sized
   card the Close button overflowed the page and hung below each card. */
for (const width of [390, 1280]) {
  test(`a closed card shows nothing of its inside page (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await settle(page);
    const inner = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".wheel .card3d-inner")].map((el) => ({
        overflow: el.scrollHeight - el.clientHeight,
        shown: [...el.children].filter((c) => getComputedStyle(c).visibility !== "hidden").length,
      })),
    );
    for (const s of inner) {
      expect(s.overflow).toBeLessThanOrEqual(0);
      expect(s.shown).toBe(0);
    }
  });
}
