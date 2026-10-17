import { expect, test } from '@playwright/test';
import { securityHeaders } from '../support/apacheHeaders';

// Serves the built portal with the exact headers production Apache will send,
// to prove the Content-Security-Policy doesn't break the page.
test('the page works under the production security headers', async ({ page }) => {
  const headers = securityHeaders();
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });

  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  await page.exposeFunction('reportCspViolation', (v: string) => problems.push(`CSP: ${v}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { reportCspViolation(v: string): void }).reportCspViolation(
        `${e.violatedDirective} blocked ${e.blockedURI}`,
      );
    });
  });

  const response = await page.goto('./');
  expect(response?.headers()['content-security-policy']).toBe(headers['Content-Security-Policy']);

  const cards = page.getByRole('list', { name: 'Games' }).locator(':scope > li');
  await expect(cards).not.toHaveCount(0);
  await expect(cards.first().getByRole('img')).toHaveJSProperty('complete', true);
  expect(await page.evaluate(() => document.fonts.check('16px "Press Start 2P"'))).toBe(true);
  // The stylesheet applied (it would be blocked if CSP rejected it).
  const bg = await page.evaluate(() => getComputedStyle(document.body).display);
  expect(bg).toBe('flex');
  expect(problems).toEqual([]);
});
