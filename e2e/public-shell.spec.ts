import {expect, test} from '@playwright/test';

test('serves the legal pages with a rail that switches between them', async ({page}) => {
  const response = await page.goto('/terms-of-use');

  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Almonium/);
  await expect(page.getByRole('heading', {level: 1, name: 'Terms of Use'})).toBeVisible();
  await expect(page.getByText(/Last updated September 17, 2026/)).toBeVisible();

  // The rail is read off the body's headings, so every section is reachable from it.
  const rail = page.getByRole('navigation', {name: 'Legal pages'});
  await expect(rail.getByRole('link', {name: 'Terms of Use'})).toHaveAttribute('aria-current', 'page');
  await expect(rail.getByRole('link', {name: '12. Changes and contact'})).toHaveAttribute('href', '#changes');
  await page.screenshot({path: 'test-results/legal-terms.png', fullPage: true, animations: 'disabled'});

  await rail.getByRole('link', {name: 'Privacy Policy'}).click();
  await expect(page).toHaveURL(/\/privacy-policy$/);
  await expect(page.getByRole('heading', {level: 1, name: 'Privacy Policy'})).toBeVisible();
  await expect(rail.getByRole('link', {name: 'Privacy Policy'})).toHaveAttribute('aria-current', 'page');
  await expect(rail.getByRole('link', {name: '4. Who else touches it'})).toBeVisible();
  await expect(page.getByRole('definition').filter({hasText: 'merchant of record'})).toBeVisible();
  await page.screenshot({path: 'test-results/legal-privacy.png', fullPage: true, animations: 'disabled'});

  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: 'test-results/legal-privacy-mobile.png', fullPage: true, animations: 'disabled'});
});
