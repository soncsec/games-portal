import { expect, test } from '@playwright/test';
import { cardGames } from '../support/gameFiles';

const data = cardGames();

test('home page lists every game with no console errors or third-party requests', async ({
  page,
}) => {
  const errors: string[] = [];
  const foreign: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') foreign.push(r.url());
  });

  await page.goto('./');
  await expect(page).toHaveTitle('Soncrant Arcade');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Soncrant Arcade');

  const cards = page.getByRole('list', { name: 'Games' }).locator(':scope > li');
  await expect(cards).toHaveCount(data.length);
  for (const [i, game] of data.entries()) {
    const card = cards.nth(i);
    await expect(card.getByRole('heading', { level: 2 })).toHaveText(game.title);
    await expect(card.getByText(game.summary)).toBeVisible();
    const img = card.getByRole('img', { name: `${game.title} screenshot` });
    await img.scrollIntoViewIfNeeded();
    // The image file exists and decoded (naturalWidth is 0 for a broken image).
    await expect
      .poll(() => img.evaluate((e: HTMLImageElement) => e.naturalWidth))
      .toBeGreaterThan(0);
    if (game.status === 'live') {
      await expect(card.getByRole('link')).toHaveAttribute('href', `./${game.slug}/`);
    } else {
      await expect(card.getByRole('link')).toHaveCount(0);
    }
  }

  // The pixel font is bundled and actually loads.
  expect(await page.evaluate(() => document.fonts.check('16px "Press Start 2P"'))).toBe(true);

  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test('cards are reachable by keyboard', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  // Only live cards are links, so Tab lands on the first live game.
  await expect(focused).toHaveAttribute(
    'href',
    `./${data.find((g) => g.status === 'live')?.slug}/`,
  );
});
