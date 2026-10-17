import { expect, test } from '@playwright/test';
import data from '../../games.json' with { type: 'json' };

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

  const links = page.getByRole('list', { name: 'Games' }).getByRole('link');
  await expect(links).toHaveCount(data.length);
  for (const [i, game] of data.entries()) {
    await expect(links.nth(i)).toHaveText(game.title);
    await expect(links.nth(i)).toHaveAttribute('href', `./${game.slug}/`);
  }

  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});
