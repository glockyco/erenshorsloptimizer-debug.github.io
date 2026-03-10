// @ts-check
const { test, expect } = require('@playwright/test');

// All tests call into the page's internal functions via window.__erenshorTest,
// a permanent test surface defined at the bottom of js/main.js.
// The page must be fully initialised before any assertions.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#gear-count')).toHaveText(/\(\d+ items\)/, { timeout: 10000 });
});

// ── getItemEffects ────────────────────────────────────────────────────────────

test.describe('getItemEffects', () => {
  test('returns all-zero object for item with no effects', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.getItemEffects({ stats: { str: 10 } })
    );
    expect(result.haste).toBe(0);
    expect(result.str).toBe(0);
    expect(result.mr).toBe(0);
  });

  test('sums worn and aura directly', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.getItemEffects({
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
      window.__erenshorTest.getItemEffects({
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
      window.__erenshorTest.getItemEffects({
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
      window.__erenshorTest.getItemEffects({
        stats: {},
        effects: { worn: { haste: 5 } },
      })
    );
    expect(result.haste).toBe(5);
    expect(result.str).toBe(0);
  });

  test('all four resist stats accumulate correctly', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.getItemEffects({
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
      window.__erenshorTest.getItemPermEffects({
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
      window.__erenshorTest.getItemPermEffects({
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
      window.__erenshorTest.getItemPermEffects({
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
      window.__erenshorTest.getItemPermEffects({
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
      window.__erenshorTest.effectBlocked({}, { 'Buff_Haste_Worn': 25 })
    );
    expect(result).toBe(false);
  });

  test('returns false when line is not in claimedLines', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 25 }, {})
    );
    expect(result).toBe(false);
  });

  test('returns true when claimed at equal req_lvl', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 25 }, { 'Buff_Haste_Worn': 25 })
    );
    expect(result).toBe(true);
  });

  test('returns true when claimed at higher req_lvl', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 10 }, { 'Buff_Haste_Worn': 25 })
    );
    expect(result).toBe(true);
  });

  test('returns false when claimed at lower req_lvl', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.effectBlocked({ line: 'Buff_Haste_Worn', req_lvl: 25 }, { 'Buff_Haste_Worn': 10 })
    );
    expect(result).toBe(false);
  });
});

// ── claimLines ────────────────────────────────────────────────────────────────

test.describe('claimLines', () => {
  test('registers a worn line', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = {};
      window.__erenshorTest.claimLines({ effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25 } } }, claimed);
      return claimed;
    });
    expect(result['Buff_Haste_Worn']).toBe(25);
  });

  test('registers an aura line', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = {};
      window.__erenshorTest.claimLines({ effects: { aura: { line: 'Regen', req_lvl: 10 } } }, claimed);
      return claimed;
    });
    expect(result['Regen']).toBe(10);
  });

  test('higher req_lvl overwrites lower', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = { 'Buff_Haste_Worn': 10 };
      window.__erenshorTest.claimLines({ effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25 } } }, claimed);
      return claimed;
    });
    expect(result['Buff_Haste_Worn']).toBe(25);
  });

  test('lower req_lvl does not overwrite higher', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = { 'Buff_Haste_Worn': 25 };
      window.__erenshorTest.claimLines({ effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 10 } } }, claimed);
      return claimed;
    });
    expect(result['Buff_Haste_Worn']).toBe(25);
  });

  test('item with no effects leaves map unchanged', async ({ page }) => {
    const result = await page.evaluate(() => {
      const claimed = { 'Regen': 5 };
      window.__erenshorTest.claimLines({ effects: {} }, claimed);
      return claimed;
    });
    expect(result).toEqual({ 'Regen': 5 });
  });
});

// ── score ─────────────────────────────────────────────────────────────────────

test.describe('score', () => {
  test('scores a stats-only item as sum(stat × weight)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 2, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      return window.__erenshorTest.score({ stats: { str: 10, dex: 5 } }, w);
    });
    expect(result).toBe(20); // str:10×2 + dex:5×0
  });

  test('worn haste contributes via haste weight', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 5 };
      return window.__erenshorTest.score({ stats: {}, effects: { worn: { haste: 10 } } }, w);
    });
    expect(result).toBe(50); // haste:10×5
  });

  test('worn stat from spell contributes once, not double-counted via item.stats', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 3, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      // item.stats has no str; worn spell grants str:10
      return window.__erenshorTest.score({ stats: {}, effects: { worn: { str: 10 } } }, w);
    });
    expect(result).toBe(30); // worn str:10×3, stats str:0×3
  });

  test('item with no stats returns 0', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 5, dex: 5, agi: 5, end: 5, int: 5, wis: 5, cha: 5, res: 5,
                  mr: 5, er: 5, pr: 5, vr: 5, haste: 5 };
      return window.__erenshorTest.score(null, w);
    });
    expect(result).toBe(0);
  });
});

// ── scoreInContext ────────────────────────────────────────────────────────────

test.describe('scoreInContext', () => {
  test('unclaimed line contributes normally', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 5 };
      return window.__erenshorTest.scoreInContext(
        { stats: {}, effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 10 } } },
        {},
        w
      );
    });
    expect(result).toBe(50); // haste:10×5
  });

  test('claimed line at equal req_lvl is zeroed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 5 };
      return window.__erenshorTest.scoreInContext(
        { stats: {}, effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 10 } } },
        { 'Buff_Haste_Worn': 25 },
        w
      );
    });
    expect(result).toBe(0);
  });

  test('proc always contributes regardless of line context', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 0, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 10 };
      // worn line is blocked, but proc haste should still score at ×0.5
      return window.__erenshorTest.scoreInContext(
        { stats: {}, effects: {
            worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 10 },
            proc: { haste: 20 },
        }},
        { 'Buff_Haste_Worn': 25 },
        w
      );
    });
    expect(result).toBe(100); // proc haste: 20×0.5×10 = 100; worn zeroed
  });

  test('base stats always score regardless of line context', async ({ page }) => {
    const result = await page.evaluate(() => {
      const w = { str: 4, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      return window.__erenshorTest.scoreInContext(
        { stats: { str: 10 }, effects: { worn: { line: 'Regen', req_lvl: 5, haste: 10 } } },
        { 'Regen': 5 },
        w
      );
    });
    expect(result).toBe(40); // str:10×4; worn zeroed
  });
});

// ── sumLoadoutEffects ─────────────────────────────────────────────────────────

test.describe('sumLoadoutEffects', () => {
  test('winner on a shared line contributes, loser is zeroed', async ({ page }) => {
    const result = await page.evaluate(() => {
      const loadout = {
        Head: { item: {
          name: 'HighHaste', stats: {},
          effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 30 } },
        }, locked: false },
        Neck: { item: {
          name: 'LowHaste', stats: {},
          effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 10, haste: 10 } },
        }, locked: false },
      };
      return window.__erenshorTest.sumLoadoutEffects(loadout);
    });
    expect(result.haste).toBe(30);
    expect(result.haste_worn).toBe(30);
  });

  test('lineConflicts has one entry naming the blocked item and winner', async ({ page }) => {
    const result = await page.evaluate(() => {
      const loadout = {
        Head: { item: {
          name: 'HighHaste', stats: {},
          effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 30 } },
        }, locked: false },
        Neck: { item: {
          name: 'LowHaste', stats: {},
          effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 10, haste: 10 } },
        }, locked: false },
      };
      return window.__erenshorTest.sumLoadoutEffects(loadout).lineConflicts;
    });
    expect(result).toHaveLength(1);
    expect(result[0].itemName).toBe('LowHaste');
    expect(result[0].blockedBy).toBe('HighHaste');
  });

  test('Generic-line effects never conflict', async ({ page }) => {
    const result = await page.evaluate(() => {
      const loadout = {
        Head: { item: {
          name: 'ItemA', stats: {},
          effects: { worn: { haste: 10 } }, // no line = Generic
        }, locked: false },
        Neck: { item: {
          name: 'ItemB', stats: {},
          effects: { worn: { haste: 20 } },
        }, locked: false },
      };
      return window.__erenshorTest.sumLoadoutEffects(loadout);
    });
    expect(result.haste).toBe(30);
    expect(result.lineConflicts).toHaveLength(0);
  });

  test('items on different lines both contribute', async ({ page }) => {
    const result = await page.evaluate(() => {
      const loadout = {
        Head: { item: {
          name: 'HasteItem', stats: {},
          effects: { worn: { line: 'Buff_Haste_Worn', req_lvl: 25, haste: 20 } },
        }, locked: false },
        Neck: { item: {
          name: 'RegenItem', stats: {},
          effects: { worn: { line: 'Regen', req_lvl: 10, haste: 5 } },
        }, locked: false },
      };
      return window.__erenshorTest.sumLoadoutEffects(loadout);
    });
    expect(result.haste).toBe(25);
    expect(result.lineConflicts).toHaveLength(0);
  });
});

// ── optimize ──────────────────────────────────────────────────────────────────

test.describe('optimize', () => {
  test('fills all slots that have available items', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ml = window.__erenshorTest.manualLoadout;
      Object.keys(ml).forEach(k => delete ml[k]);
      window.__erenshorTest.optimize();
      // Return which slot keys were filled
      return Object.keys(ml);
    });
    // At minimum, common slots should be filled (Head, Chest, etc.)
    expect(result.length).toBeGreaterThan(0);
  });

  test('does not replace a locked slot', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ml = window.__erenshorTest.manualLoadout;
      Object.keys(ml).forEach(k => delete ml[k]);
      // Lock a specific item into Head before optimizing
      const headItem = window.__erenshorTest.gear.find(g => g.slot === 'Head');
      if (!headItem) return null;
      ml['Head'] = { item: headItem, locked: true };
      const lockedName = headItem.name;
      window.__erenshorTest.optimize();
      return { lockedName, resultName: ml['Head']?.item?.name };
    });
    expect(result).not.toBeNull();
    expect(result.resultName).toBe(result.lockedName);
  });

  test('2H weapon in Primary clears Secondary', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ml = window.__erenshorTest.manualLoadout;
      Object.keys(ml).forEach(k => delete ml[k]);
      const twoHander = window.__erenshorTest.gear.find(g => g.twoHanded);
      if (!twoHander) return 'no-2h';
      ml['Primary'] = { item: twoHander, locked: true };
      window.__erenshorTest.optimize();
      return ml['Secondary'] ? 'filled' : 'empty';
    });
    // Either there's no 2H in the DB (skip) or Secondary must be empty
    if (result !== 'no-2h') expect(result).toBe('empty');
  });

  test('relic item does not fill both Ring slots', async ({ page }) => {
    const result = await page.evaluate(() => {
      const ml = window.__erenshorTest.manualLoadout;
      Object.keys(ml).forEach(k => delete ml[k]);
      window.__erenshorTest.optimize();
      const r0 = ml['Ring_0']?.item;
      const r1 = ml['Ring_1']?.item;
      if (!r0 || !r1) return 'incomplete';
      if (r0.relic && r1.relic) return r0.name === r1.name ? 'same-relic' : 'different-relics';
      return 'ok';
    });
    expect(result).not.toBe('same-relic');
  });
});

// ── computeMaxScore ───────────────────────────────────────────────────────────

test.describe('computeMaxScore', () => {
  test('returns a positive number after gear loads', async ({ page }) => {
    const result = await page.evaluate(() => {
      window.__erenshorTest.weights = { str: 5, dex: 5, agi: 5, end: 5, int: 5, wis: 5, cha: 5, res: 5,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 5 };
      return window.__erenshorTest.computeMaxScore();
    });
    expect(result).toBeGreaterThan(0);
  });

  test('changes when weights change', async ({ page }) => {
    const [score1, score2] = await page.evaluate(() => {
      window.__erenshorTest.weights = { str: 1, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      const s1 = window.__erenshorTest.computeMaxScore();
      window.__erenshorTest.weights = { str: 10, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      const s2 = window.__erenshorTest.computeMaxScore();
      return [s1, s2];
    });
    expect(score2).toBeGreaterThan(score1);
  });

  test('relic ring counted once plus next-best, not twice', async ({ page }) => {
    // Build a minimal gear list with one relic ring (score 10) and one
    // non-relic ring (score 5). Max for Ring slots should be 15, not 20.
    const result = await page.evaluate(() => {
      window.__erenshorTest.weights = { str: 1, dex: 0, agi: 0, end: 0, int: 0, wis: 0, cha: 0, res: 0,
                  mr: 0, er: 0, pr: 0, vr: 0, haste: 0 };
      const g = window.__erenshorTest.gear;
      const saved = g.slice();
      g.length = 0;
      g.push({ name: 'RelicRing',  slot: 'Ring', lvl: 1, stats: { str: 10 }, classes: ['Windblade'], relic: true,  source: 'wiki', id: 1 });
      g.push({ name: 'NormalRing', slot: 'Ring', lvl: 1, stats: { str: 5  }, classes: ['Windblade'], relic: false, source: 'wiki', id: 2 });
      const max = window.__erenshorTest.computeMaxScore();
      g.length = 0;
      saved.forEach(item => g.push(item));
      return max;
    });
    // relic (10) + normal (5) = 15; NOT relic×2 = 20
    expect(result).toBe(15);
  });
});

// ── bankersRound ──────────────────────────────────────────────────────────────

test.describe('bankersRound', () => {
  test('rounds 1.5 to 2 (half-to-even, floor is odd)', async ({ page }) => {
    expect(await page.evaluate(() => window.__erenshorTest.bankersRound(1.5))).toBe(2);
  });
  test('rounds 2.5 to 2 (half-to-even, floor is even)', async ({ page }) => {
    expect(await page.evaluate(() => window.__erenshorTest.bankersRound(2.5))).toBe(2);
  });
  test('rounds 3.5 to 4 (half-to-even, floor is odd)', async ({ page }) => {
    expect(await page.evaluate(() => window.__erenshorTest.bankersRound(3.5))).toBe(4);
  });
  test('rounds 0.5 to 0 (half-to-even, floor is even)', async ({ page }) => {
    expect(await page.evaluate(() => window.__erenshorTest.bankersRound(0.5))).toBe(0);
  });
  test('rounds 1.4 down to 1', async ({ page }) => {
    expect(await page.evaluate(() => window.__erenshorTest.bankersRound(1.4))).toBe(1);
  });
  test('rounds 1.6 up to 2', async ({ page }) => {
    expect(await page.evaluate(() => window.__erenshorTest.bankersRound(1.6))).toBe(2);
  });
});

// ── applyTier ─────────────────────────────────────────────────────────────────

test.describe('applyTier', () => {
  test('base tier returns stats object unchanged', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.applyTier({ str: 10, res: 2 }, 'base')
    );
    expect(result).toEqual({ str: 10, res: 2 });
  });

  test('blessed multiplies stats by 1.5 with banker\'s rounding', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.applyTier({ str: 10, dex: 3 }, 'blessed')
    );
    // 10 * 1.5 = 15 (exact), 3 * 1.5 = 4.5 → bankersRound → 4 (floor 4 is even)
    expect(result).toEqual({ str: 15, dex: 4 });
  });

  test('blessed adds +1 to res, does not multiply it', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.applyTier({ str: 10, res: 5 }, 'blessed')
    );
    expect(result.res).toBe(6);
    expect(result.str).toBe(15);
  });

  test('godly doubles all stats', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.applyTier({ str: 10, dex: 7 }, 'double')
    );
    expect(result).toEqual({ str: 20, dex: 14 });
  });

  test('godly adds +2 to res, does not double it', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.applyTier({ str: 10, res: 5 }, 'double')
    );
    expect(result.res).toBe(7);
    expect(result.str).toBe(20);
  });

  test('negative stats pass through unchanged under blessed', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.applyTier({ str: 10, dex: -3 }, 'blessed')
    );
    expect(result.dex).toBe(-3);
  });

  test('negative stats pass through unchanged under godly', async ({ page }) => {
    const result = await page.evaluate(() =>
      window.__erenshorTest.applyTier({ str: 10, dex: -3 }, 'double')
    );
    expect(result.dex).toBe(-3);
  });
});
