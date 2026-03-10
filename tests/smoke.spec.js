// @ts-check
const { test, expect } = require('@playwright/test');

// gear.json loads asynchronously via fetch(); we wait for the gear count to
// appear in #gear-count before asserting anything that depends on it.
const GEAR_COUNT_RE = /\(\d+ items\)/;

test.describe('Erenshor Gear Sloptimizer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait until gear.json has been fetched and the gear count is rendered.
    // This covers the full init() path including WIKI_GEAR population.
    await expect(page.locator('#gear-count')).toHaveText(GEAR_COUNT_RE, { timeout: 10000 });
  });

  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle('Erenshor Gear Sloptimizer');
  });

  test('gear.json loads and populates the gear list', async ({ page }) => {
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
    // All items loaded from gear.json get source='wiki', which renders as
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
});
