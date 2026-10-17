import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WIDTHS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

for (const vp of WIDTHS) {
  test(`no WCAG 2.1 AA violations (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('./');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('list', { name: 'Games' }).locator(':scope > li')).not.toHaveCount(
      0,
    );

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const summary = results.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
    expect(summary).toEqual([]);
  });
}

test('page has one h1, then an h2 per game', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const cards = page.getByRole('list', { name: 'Games' }).locator(':scope > li');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(await cards.count());
});

test('motion is off when the player asks for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const animation = await page
    .locator('.wordmark-top')
    .evaluate((e) => getComputedStyle(e).animationName);
  expect(animation).toBe('none');
});
