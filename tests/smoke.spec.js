// @ts-check
const { test, expect } = require('@playwright/test');

// gear.js defines GEAR_DATA synchronously; init() runs after DOMContentLoaded.
// We wait for #gear-count to be populated before asserting anything that
// depends on the gear list being rendered.
const GEAR_COUNT_RE = /\(\d+ items\)/;

test.describe('Erenshor Gear Sloptimizer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait until init() has run and the gear count is rendered.
    await expect(page.locator('#gear-count')).toHaveText(GEAR_COUNT_RE, { timeout: 10000 });
  });

  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('Erenshor Gear Sloptimizer');
  });

  test('gear.js loads and populates the gear list', async ({ page }) => {
    const text = await page.locator('#gear-count').textContent();
    const match = text?.match(/\((\d+) items\)/);
    expect(match).not.toBeNull();
    // The count reflects items for the active class, not the full DB total.
    // We just verify that gear loaded (non-zero), not an exact count.
    const count = parseInt(match[1], 10);
    expect(count).toBeGreaterThan(0);
  });

  test('all class buttons render', async ({ page }) => {
    const expectedClasses = ['Windblade', 'Paladin', 'Reaver', 'Druid', 'Stormcaller', 'Arcanist'];
    for (const cls of expectedClasses) {
      await expect(
        page.locator('#class-bar .class-btn', { hasText: cls })
      ).toBeVisible();
    }
  });

  test('Windblade is active by default', async ({ page }) => {
    await expect(
      page.locator('#class-bar .class-btn.active')
    ).toContainText('Windblade');
  });

  test('Find Best Loadout populates the loadout builder', async ({ page }) => {
    await page.locator('.optimize-btn').click();

    // After optimizing, the loadout builder panel should contain equipped slots.
    // At least one slot should be filled (has an item name visible).
    await expect(
      page.locator('#loadout-builder-panel .result-item-name').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('no items carry a "custom" tag — all gear is from the wiki', async ({ page }) => {
    // All items loaded from gear.js get source='wiki', which renders as
    // <span class="tag tag-wiki">wiki</span>. Custom items added manually
    // render as <span class="tag tag-manual">custom</span>.
    // This test asserts the database contains only wiki items on fresh load.
    const customTags = page.locator('.tag-manual');
    await expect(customTags).toHaveCount(0);
  });

  test('switching class updates the description', async ({ page }) => {
    await page.locator('#class-bar .class-btn', { hasText: 'Paladin' }).click();
    await expect(page.locator('#class-desc')).toContainText('Paladin');
    await expect(
      page.locator('#class-bar .class-btn.active')
    ).toContainText('Paladin');
  });

  test('stat totals row renders .stat-total elements after optimizing', async ({ page }) => {
    await page.locator('.optimize-btn').click();
    await expect(page.locator('#loadout-builder-panel .result-item-name').first()).toBeVisible({ timeout: 5000 });
    const totals = page.locator('#loadout-builder-panel .stat-total');
    await expect(totals.first()).toBeVisible();
    // One column per stat in STATS (12 stats defined in data.js)
    expect(await totals.count()).toBe(12);
  });

  test('tier badge renders after cycling a slot to blessed', async ({ page }) => {
    await page.locator('.optimize-btn').click();
    await expect(page.locator('#loadout-builder-panel .result-item-name').first()).toBeVisible({ timeout: 5000 });
    // Click the tier badge button on the first equipped slot to cycle to Blessed
    const tierBtn = page.locator('#loadout-builder-panel .result-slot.equipped button', { hasText: /Base|Blessed|Godly/ }).first();
    await tierBtn.click();
    await expect(
      page.locator('#loadout-builder-panel .result-slot.equipped button', { hasText: /Blessed|Godly/ }).first()
    ).toBeVisible();
  });

  test('source tag renders in at least one slot after optimizing', async ({ page }) => {
    await page.locator('.optimize-btn').click();
    await expect(page.locator('#loadout-builder-panel .result-item-name').first()).toBeVisible({ timeout: 5000 });
    // Source info appears as an italic div containing a source icon
    const sourceDiv = page.locator('#loadout-builder-panel .result-slot.equipped div[title]').first();
    await expect(sourceDiv).toBeVisible();
  });

  test('effects panel renders when loadout has haste items', async ({ page }) => {
    // Windblade default has haste weight 8 and haste items in DB; optimizer fills them
    await page.locator('.optimize-btn').click();
    await expect(page.locator('#loadout-builder-panel .result-item-name').first()).toBeVisible({ timeout: 5000 });
    // The effects panel header is always "Spell & Passive Effects" when present
    await expect(page.locator('#loadout-builder-panel').getByText('Spell & Passive Effects')).toBeVisible();
  });

  test('comparison bar renders when both panels are filled', async ({ page }) => {
    // Fill builder via optimizer
    await page.locator('.optimize-btn').click();
    await expect(page.locator('#loadout-builder-panel .result-item-name').first()).toBeVisible({ timeout: 5000 });
    // Fill current gear by clicking the first slot and selecting the first item
    await page.locator('#current-gear-panel .result-slot').first().click();
    await expect(page.locator('#slot-modal-backdrop')).toBeVisible({ timeout: 3000 });
    await page.locator('.smi').first().click();
    // Comparison bar should now be visible with the heading text
    await expect(page.locator('#comparison-bar').getByText('Loadout Comparison')).toBeVisible();
  });

  test('delta arrows render in builder score bar when current gear differs', async ({ page }) => {
    await page.locator('.optimize-btn').click();
    await expect(page.locator('#loadout-builder-panel .result-item-name').first()).toBeVisible({ timeout: 5000 });
    // Fill all current gear slots by optimizing, then swap one item to create a
    // score difference. We inject a minimal item into current gear via the test
    // surface to guarantee the totals differ from the builder.
    await page.evaluate(() => {
      const ml = window.__erenshorTest.state.manualLoadout;
      const cl = window.__erenshorTest.state.currentLoadout;
      // Copy first builder slot to current gear but zero out its stats so scores differ
      const firstKey = Object.keys(ml)[0];
      if (firstKey) {
        cl[firstKey] = { item: { ...ml[firstKey].item, stats: {} }, locked: false };
      }
      renderBothLoadouts();
    });
    // Delta arrows (▲ or ▼) should now be visible in stat-total cells
    await expect(
      page.locator('#loadout-builder-panel .stat-total').getByText(/[▲▼]/).first()
    ).toBeVisible();
  });

  test('slot modal opens and lists items when a slot is clicked', async ({ page }) => {
    await page.locator('#current-gear-panel .result-slot').first().click();
    await expect(page.locator('#slot-modal-backdrop')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#slot-modal-results .smi').first()).toBeVisible();
  });

  test('lock button toggles locked class on slot', async ({ page }) => {
    await page.locator('.optimize-btn').click();
    await expect(page.locator('#loadout-builder-panel .result-item-name').first()).toBeVisible({ timeout: 5000 });
    // Initially no locked slots
    await expect(page.locator('#loadout-builder-panel .result-slot.locked')).toHaveCount(0);
    // Click the first lock button
    await page.locator('#loadout-builder-panel .lock-btn').first().click();
    // One slot should now carry the locked class
    await expect(page.locator('#loadout-builder-panel .result-slot.locked')).toHaveCount(1);
  });
});
