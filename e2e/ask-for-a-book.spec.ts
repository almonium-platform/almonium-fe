import {expect, test} from '@playwright/test';

const book = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'dorian-gray-en', workSlug: 'the-picture-of-dorian-gray', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', language: 'EN', cefrLevel: 'C1', editionType: 'original', description: '', publicationYear: 1890, coverUrl: null, wordCount: 78000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: false};

test('the foot of the shelf carries one quiet ask line, and an empty search turns into the same line', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('read_library_view', JSON.stringify('covers')));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/public/books')) await route.fulfill({json: [book]});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });

  await page.goto('/read');
  const shelf = page.locator('.book-shelf').last();
  await expect(shelf.locator('.cover-book')).toHaveCount(1);

  // The line sits below the last row, never as a tile in the grid, and appears once the end is in view.
  const line = shelf.locator('.ask-line');
  await expect(line).toHaveText('Missing a classic? Ask for a book');
  await expect(shelf.locator('.shelf .ask-line')).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('ask-line.png'), animations: 'disabled'});

  // An empty search replaces the grid with the same line, the term in it.
  await page.getByPlaceholder('Title or author').fill('Dracula');
  await expect(shelf.locator('.cover-book')).toHaveCount(0);
  const empty = shelf.locator('.ask-line--empty');
  await expect(empty).toContainText('Nothing for ‘Dracula’.');
  await expect(empty.getByRole('button', {name: 'Ask for it.'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('ask-line-empty.png'), animations: 'disabled'});

  // A guest is sent to sign in first.
  await empty.getByRole('button', {name: 'Ask for it.'}).click();
  await expect(page).toHaveURL(/\/auth\?.*returnUrl=%2Fread/);
});
