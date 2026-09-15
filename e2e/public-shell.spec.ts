import {expect, test} from '@playwright/test';

test('serves the public legal route', async ({page}) => {
  const response = await page.goto('/terms-of-use');

  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/Almonium/);
  await expect(page.getByText("I'm still working on this page.")).toBeVisible();
});
