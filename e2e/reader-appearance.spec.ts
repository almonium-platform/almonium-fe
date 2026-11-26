import {Page, expect, test} from '@playwright/test';

// G25–G27: the appearance panel restyles the page behind it, and the choice is kept for the next visit.
const id = '01989f47-4c2a-7a10-9e5b-751983624a25';
const book = {id, editionSlug: 'original-fr', workSlug: 'book', title: 'Madame Bovary', author: 'Gustave Flaubert', language: 'FR', cefrLevel: 'B2', description: '', publicationYear: 1857, coverUrl: null, wordCount: 4000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []};
const chapters = [
  {id, sequence: 8, title: 'VI', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: []},
  {id, sequence: 9, title: 'VII', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['Emma thinks of the honeymoon she did not have.']},
];
const text = '<section class="chapter"><h2 class="chapter-title" id="chapter-8">VI</h2><p>Elle avait lu Paul et Virginie.</p></section>'
  + '<section class="chapter"><h2 class="chapter-title" id="chapter-9">VII</h2>'
  + '<p>Elle songeait quelquefois que c’étaient là pourtant les plus beaux jours de sa vie, la lune de miel, comme on disait. Pour en goûter la douceur, il eût fallu, sans doute, s’en aller vers ces pays à noms sonores où les lendemains de mariage ont de plus suaves paresses !</p>'
  + '<p>Quand le soleil se couche, on respire au bord des golfes le parfum des citronniers ; puis, le soir, sur la terrasse des villas, seuls et les doigts confondus, on regarde les étoiles en faisant des projets.</p>'
  + '<p>Que ne pouvait-elle s’accouder sur le balcon des chalets suisses ou enfermer sa tristesse dans un cottage écossais, avec un mari vêtu d’un habit de velours noir à longues basques !</p></section>';

async function openChapter(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('FR')));
  // Matches the API under either prefix, /api/v1 or /v1.
  await page.route(/(api\.almonium\.com|localhost:9998)\/(api\/)?v1\//, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/public/books/original-fr/chapters')) await route.fulfill({json: chapters});
    else if (url.pathname.endsWith('/public/books/original-fr/text')) await route.fulfill({contentType: 'text/html', body: text});
    else if (url.pathname.endsWith('/public/books/original-fr')) await route.fulfill({json: book});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });
  await page.goto('/books/original-fr/9');
  await expect(page.locator('.reader-content')).toContainText('citronniers');
}

// Change detection is coalesced onto the next frame, so a read straight after a tap is polled, never taken once.
const style = (page: Page, property: string) =>
  page.locator('.reader-content p').first().evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property);
const ground = (page: Page) => page.locator('.reader-container').evaluate(node => getComputedStyle(node).backgroundColor);
const columnWidth = async (page: Page) => Math.round((await page.locator('.reader-content').boundingBox())!.width);

test('the panel opens above Aa and every control repaints the page', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1280, height: 900});
  await openChapter(page);

  // The bar is a pill fitted to its contents, not a plank across the page.
  const bar = (await page.locator('.pagination-controls').boundingBox())!;
  expect(bar.width).toBeLessThan(640);

  const aa = page.getByRole('button', {name: 'Appearance'});
  await aa.click();
  const panel = page.getByRole('dialog', {name: 'Reader appearance'});
  await expect(panel).toBeVisible();
  const panelBox = (await panel.boundingBox())!;
  const aaBox = (await aa.boundingBox())!;
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(aaBox.y);
  await page.screenshot({path: testInfo.outputPath('appearance-auto.png'), animations: 'disabled'});

  // The defaults: Literata at 19px, 1.65, a 680px column.
  await expect.poll(() => style(page, 'font-size')).toBe('19px');
  await expect.poll(() => style(page, 'font-family')).toContain('Literata');
  await expect.poll(() => columnWidth(page)).toBe(680);

  await panel.getByRole('radio', {name: 'Sepia'}).click();
  await expect(page.locator('app-reader')).toHaveAttribute('data-reader-theme', 'sepia');
  await expect.poll(() => ground(page)).toBe('rgb(243, 234, 216)');
  await page.screenshot({path: testInfo.outputPath('appearance-sepia.png'), animations: 'disabled'});

  await panel.getByRole('radio', {name: 'Night'}).click();
  await expect.poll(() => ground(page)).toBe('rgb(20, 17, 26)');
  await expect.poll(() => style(page, 'color')).toBe('rgb(221, 213, 224)');

  await panel.getByRole('radio', {name: 'Atkinson'}).click();
  await expect.poll(() => style(page, 'font-family')).toContain('Atkinson Hyperlegible');
  await panel.getByRole('button', {name: 'Larger text'}).click();
  await panel.getByRole('button', {name: 'Larger text'}).click();
  await expect.poll(() => style(page, 'font-size')).toBe('23px');
  await panel.getByRole('radio', {name: 'Loose line spacing'}).click();
  await expect.poll(async () => parseFloat(await style(page, 'line-height'))).toBeCloseTo(23 * 1.9, 0);
  await panel.getByRole('radio', {name: 'Wide column'}).click();
  await expect.poll(() => columnWidth(page)).toBe(800);
  await page.screenshot({path: testInfo.outputPath('appearance-night-large.png'), animations: 'disabled'});

  // Escape closes it; the choice survives a reload on this device.
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.reader-content')).toContainText('citronniers');
  await expect(page.locator('app-reader')).toHaveAttribute('data-reader-theme', 'night');
  await expect.poll(() => style(page, 'font-size')).toBe('23px');

  // Reset puts all five back, and a click on the page closes the panel.
  await page.getByRole('button', {name: 'Appearance'}).click();
  await page.getByRole('button', {name: 'Reset'}).click();
  await expect(page.locator('app-reader')).not.toHaveAttribute('data-reader-theme');
  await expect.poll(() => style(page, 'font-size')).toBe('19px');
  await expect(page.getByRole('button', {name: 'Reset'})).toBeDisabled();
  await page.locator('.chapter-head__title').click();
  await expect(page.getByRole('dialog', {name: 'Reader appearance'})).toHaveCount(0);
});

test('on a phone the panel is a sheet without Width, and text runs 2px under the step', async ({page}, testInfo) => {
  await page.setViewportSize({width: 390, height: 844});
  await openChapter(page);
  await expect.poll(() => style(page, 'font-size')).toBe('17px');

  await page.getByRole('button', {name: 'Appearance'}).click();
  const sheet = page.getByRole('dialog', {name: 'Reader appearance'});
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(390);
  expect(Math.round(box.y + box.height)).toBe(844);
  await expect(sheet.getByRole('radiogroup', {name: 'Width'})).toHaveCount(0);
  expect((await sheet.getByRole('button', {name: 'Larger text'}).boundingBox())!.height).toBe(44);

  await sheet.getByRole('radio', {name: 'Sepia'}).click();
  await sheet.getByRole('button', {name: 'Larger text'}).click();
  await expect.poll(() => style(page, 'font-size')).toBe('19px');
  await page.screenshot({path: testInfo.outputPath('appearance-phone.png'), animations: 'disabled'});
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
