// @ts-check
const { test, expect } = require('@playwright/test');

// All tests call into the page's global functions via page.evaluate().
// The page must be fully initialised before any assertions.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#gear-count')).toHaveText(/\(\d+ items\)/, { timeout: 10000 });
});

// ── getItemEffects ────────────────────────────────────────────────────────────

test.describe('getItemEffects', () => {
  test('returns all-zero object for item with no effects', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemEffects({ stats: { str: 10 } })
    );
    expect(result.haste).toBe(0);
    expect(result.str).toBe(0);
    expect(result.mr).toBe(0);
  });

  test('sums worn and aura directly', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemEffects({
        stats: {},
        effects: {
          worn: { haste: 10, str: 5 },
          aura: { haste: 20, str: 3 },
        },
      })
    );
    expect(result.haste).toBe(30);
    expect(result.str).toBe(8);
  });

  test('discounts proc by 0.5', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemEffects({
        stats: {},
        effects: {
          proc: { haste: 20, mr: 10 },
        },
      })
    );
    expect(result.haste).toBe(10);
    expect(result.mr).toBe(5);
  });

  test('movespeed has no proc contribution', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemEffects({
        stats: {},
        effects: {
          worn: { movespeed: 10 },
          proc: { movespeed: 20 },
        },
      })
    );
    expect(result.movespeed).toBe(10);
  });

  test('missing buckets treated as zero', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemEffects({
        stats: {},
        effects: { worn: { haste: 5 } },
      })
    );
    expect(result.haste).toBe(5);
    expect(result.str).toBe(0);
  });

  test('all four resist stats accumulate correctly', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemEffects({
        stats: {},
        effects: {
          worn: { mr: 4, er: 3 },
          aura: { pr: 2 },
          proc: { vr: 10 },
        },
      })
    );
    expect(result.mr).toBe(4);
    expect(result.er).toBe(3);
    expect(result.pr).toBe(2);
    expect(result.vr).toBe(5); // proc × 0.5
  });
});

// ── getItemPermEffects ────────────────────────────────────────────────────────

test.describe('getItemPermEffects', () => {
  test('excludes proc from permanent totals', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemPermEffects({
        stats: {},
        effects: {
          worn: { haste: 10 },
          proc: { haste: 20 },
        },
      })
    );
    expect(result.haste).toBe(10);
  });

  test('exposes raw proc values as _proc sub-labels', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemPermEffects({
        stats: {},
        effects: {
          worn: { haste: 10 },
          proc: { haste: 20, lifesteal: 5 },
        },
      })
    );
    expect(result.haste_proc).toBe(20);
    expect(result.lifesteal_proc).toBe(5);
  });

  test('sums worn and aura permanently', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemPermEffects({
        stats: {},
        effects: {
          worn: { haste: 10, mr: 4 },
          aura: { haste: 15, mr: 2 },
        },
      })
    );
    expect(result.haste).toBe(25);
    expect(result.mr).toBe(6);
  });

  test('returns zero proc sub-labels when no proc', async ({ page }) => {
    const result = await page.evaluate(() =>
      getItemPermEffects({
        stats: {},
        effects: { worn: { haste: 5 } },
      })
    );
    expect(result.haste_proc).toBe(0);
    expect(result.lifesteal_proc).toBe(0);
  });
});

// ── effectBlocked ─────────────────────────────────────────────────────────────

test.describe('effectBlocked', () => {
  test('returns false when effect has no line', async ({ page }) => {
    const result = await page.evaluate(() =>
      effectBlocked({}, { 'Buff_Haste_Worn': 25 })
    );
    expect(result).toBe(false);
  });

  test('returns false when line is not in claimedLines', async ({ page }) => {
    const result = await page.evaluate(() =>
      effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 25 }, {})
    );
    expect(result).toBe(false);
  });

  test('returns true when claimed at equal req_lvl', async ({ page }) => {
    const result = await page.evaluate(() =>
      effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 25 }, { 'Buff_Haste_Worn': 25 })
    );
    expect(result).toBe(true);
  });

  test('returns true when claimed at higher req_lvl', async ({ page }) => {
    const result = await page.evaluate(() =>
      effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 10 }, { 'Buff_Haste_Worn': 25 })
    );
    expect(result).toBe(true);
  });

  test('returns false when claimed at lower req_lvl', async ({ page }) => {
    const result = await page.evaluate(() =>
      effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 25 }, { 'Buff_Haste_Worn': 10 })
    );
    expect(result).toBe(false);
  });
});

// ── claimLines ────────────────────────────────────────────────────────────────

test.describe('claimLines', () => {
  test('registers a worn line', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = {};
      claimLines({ effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25 } } }, claimed);
      return claimed;
    });
    expect(result['Buff_Haste_Worn']).toBe(25);
  });

  test('registers an aura line', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = {};
      claimLines({ effects: { aura: { line: 'Regen', req_lvl: 10 } } }, claimed);
      return claimed;
    });
    expect(result['Regen']).toBe(10);
  });

  test('higher req_lvl overwrites lower', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = { 'Buff_Haste_Worn': 10 };
      claimLines({ effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25 } } }, claimed);
      return claimed;
    });
    expect(result['Buff_Haste_Worn']).toBe(25);
  });

  test('lower req_lvl does not overwrite higher', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = { 'Buff_Haste_Worn': 25 };
      claimLines({ effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 10 } } }, claimed);
      return claimed;
    });
    expect(result['Buff_Haste_Worn']).toBe(25);
  });

  test('item with no effects leaves map unchanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = { 'Regen': 5 };
      claimLines({ effects: {} }, claimed);
      return claimed;
    });
    expect(result).toEqual({ 'Regen': 5 });
  });
});

// ── score ─────────────────────────────────────────────────────────────────────

test.describe('score', () => {
  test('scores a stats-only item as sum(stat × weight)', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 2, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      return score({ stats: { str: 10, dex: 5 } });
    });
    expect(result).toBe(20); // str:10×2 + dex:5×0
  });

  test('worn haste contributes via haste weight', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 5 };
      return score({ stats: {}, effects: { worn: { haste: 10 } } });
    });
    expect(result).toBe(50); // haste:10×5
  });

  test('worn stat from spell contributes once, not double-counted via item.stats', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 3, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      // item.stats has no str; worn spell grants str:10
      return score({ stats: {}, effects: { worn: { str: 10 } } });
    });
    expect(result).toBe(30); // worn str:10×3, stats str:0×3
  });

  test('item with no stats returns 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 5, dex: 5, agi: 5, end: 5, int: 5, wis: 5, cha: 5, res: 5,
                  mr: 5, er: 5, pr: 5, vr: 5, haste: 5 };
      return score(null);
    });
    expect(result).toBe(0);
  });
});

// ── scoreInContext ────────────────────────────────────────────────────────────

test.describe('scoreInContext', () => {
  test('unclaimed line contributes normally', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 5 };
      return scoreInContext(
        { stats: {}, effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 10 } } },
        {}
      );
    });
    expect(result).toBe(50); // haste:10×5
  });

  test('claimed line at equal req_lvl is zeroed', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 5 };
      return scoreInContext(
        { stats: {}, effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 10 } } },
        { 'Buff_Haste_Worn': 25 }
      );
    });
    expect(result).toBe(0);
  });

  test('proc always contributes regardless of line context', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 10 };
      // worn line is blocked, but proc haste should still score at ×0.5
      return scoreInContext(
        { stats: {}, effects: {
            worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 10 },
            proc: { haste: 20 },
        }},
        { 'Buff_Haste_Worn': 25 }
      );
    });
    expect(result).toBe(100); // proc haste: 20×0.5×10 = 100; worn zeroed
  });

  test('base stats always score regardless of line context', async ({ page }) => {
    const result = await page.evaluate(() => {
      weights = { str: 4, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      return scoreInContext(
        { stats: { str: 10 }, effects: { worn: { line: 'Regen', req_lvl: 5, haste: 10 } } },
        { 'Regen': 5 }
      );
    });
    expect(result).toBe(40); // str:10×4; worn zeroed
  });
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
