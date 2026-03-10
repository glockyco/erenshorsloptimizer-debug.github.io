// @ts-check
const { test, expect } = require('@playwright/test');

// All tests call into the page's global functions via page.evaluate().
// The page must be fully initialised before any assertions.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#gear-count')).toHaveText(/\(\d+ items\)/, { timeout: 10000 });
});

// ── bankersRound ──────────────────────────────────────────────────────────────

test.describe('bankersRound', () => {
  test('rounds 1.5 to 2 (half-to-even, floor is odd)', async ({ page }) => {
    expect(await page.evaluate(() => bankersRound(1.5))).toBe(2);
  });
  test('rounds 2.5 to 2 (half-to-even, floor is even)', async ({ page }) => {
    expect(await page.evaluate(() => bankersRound(2.5))).toBe(2);
  });
  test('rounds 3.5 to 4 (half-to-even, floor is odd)', async ({ page }) => {
    expect(await page.evaluate(() => bankersRound(3.5))).toBe(4);
  });
  test('rounds 0.5 to 0 (half-to-even, floor is even)', async ({ page }) => {
    expect(await page.evaluate(() => bankersRound(0.5))).toBe(0);
  });
  test('rounds 1.4 down to 1', async ({ page }) => {
    expect(await page.evaluate(() => bankersRound(1.4))).toBe(1);
  });
  test('rounds 1.6 up to 2', async ({ page }) => {
    expect(await page.evaluate(() => bankersRound(1.6))).toBe(2);
  });
});

// ── applyTier ─────────────────────────────────────────────────────────────────

test.describe('applyTier', () => {
  test('base tier returns stats object unchanged', async ({ page }) => {
    const result = await page.evaluate(() =>
      applyTier({ str: 10, res: 2 }, 'base')
    );
    expect(result).toEqual({ str: 10, res: 2 });
  });

  test('blessed multiplies stats by 1.5 with banker\'s rounding', async ({ page }) => {
    const result = await page.evaluate(() =>
      applyTier({ str: 10, dex: 3 }, 'blessed')
    );
    // 10 * 1.5 = 15 (exact), 3 * 1.5 = 4.5 → bankersRound → 4 (floor 4 is even)
    expect(result).toEqual({ str: 15, dex: 4 });
  });

  test('blessed adds +1 to res, does not multiply it', async ({ page }) => {
    const result = await page.evaluate(() =>
      applyTier({ str: 10, res: 5 }, 'blessed')
    );
    expect(result.res).toBe(6);
    expect(result.str).toBe(15);
  });

  test('godly doubles all stats', async ({ page }) => {
    const result = await page.evaluate(() =>
      applyTier({ str: 10, dex: 7 }, 'double')
    );
    expect(result).toEqual({ str: 20, dex: 14 });
  });

  test('godly adds +2 to res, does not double it', async ({ page }) => {
    const result = await page.evaluate(() =>
      applyTier({ str: 10, res: 5 }, 'double')
    );
    expect(result.res).toBe(7);
    expect(result.str).toBe(20);
  });

  test('negative stats pass through unchanged under blessed', async ({ page }) => {
    const result = await page.evaluate(() =>
      applyTier({ str: 10, dex: -3 }, 'blessed')
    );
    expect(result.dex).toBe(-3);
  });

  test('negative stats pass through unchanged under godly', async ({ page }) => {
    const result = await page.evaluate(() =>
      applyTier({ str: 10, dex: -3 }, 'double')
    );
    expect(result.dex).toBe(-3);
  });
});
