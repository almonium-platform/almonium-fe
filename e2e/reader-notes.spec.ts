import {Page, expect, test} from '@playwright/test';

// J12, J13: a reader note opens against its phrase and never covers it.
const id = '01989f47-4c2a-7a10-9e5b-751983624a25';
const book = {id, editionSlug: 'original-en', workSlug: 'book', title: 'Frankenstein', author: 'Mary Shelley', language: 'EN', cefrLevel: 'B2', description: '', publicationYear: 1818, coverUrl: null, wordCount: 4000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []};
const chapters = [{id, sequence: 21, title: 'CHAPTER XXI.', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['Victor is taken before a magistrate.']}];
const mark = (quote: string, note: string) => `<span class="almonium-gloss" role="button" tabindex="0" data-gloss-note="${note}">${quote}</span>`;
const text = '<section class="chapter"><h2 class="chapter-title" id="chapter-21">CHAPTER XXI.</h2>'
  + '<p>“I do not know,” said the man, “what the custom of the English may be, but it is the custom of the Irish to hate villains.” '
  + 'While this strange dialogue continued, I perceived the crowd rapidly increase. Their faces expressed a mixture of curiosity and anger, '
  + `which annoyed and ${mark('in some degree', 'To some extent; a little.')} alarmed me.</p>`
  + `<p>“Ay, sir, free enough for honest folks. Mr. Kirwin is ${mark('a magistrate', 'A local official with legal authority, able to investigate offences and conduct preliminary proceedings.')}; `
  + 'and you are to give an account of the death of a gentleman who was found murdered here last night.”</p>'
  + '<p>This answer startled me; but I presently recovered myself. I was innocent; that could easily be proved.</p></section>';

async function openChapter(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('DE')));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/public/books/original-en/chapters')) await route.fulfill({json: chapters});
    else if (url.pathname.endsWith('/public/books/original-en/text')) await route.fulfill({contentType: 'text/html', body: text});
    else if (url.pathname.endsWith('/public/books/original-en')) await route.fulfill({json: book});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });
  await page.goto('/books/original-en/21');
  await expect(page.locator('.reader-content')).toContainText('Mr. Kirwin');
}

test('a reader note opens under its phrase on desktop, and closes on Escape', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1280, height: 1000});
  await openChapter(page);
  const phrase = page.locator('.almonium-gloss', {hasText: 'a magistrate'});
  await phrase.click();
  const note = page.getByRole('note', {name: 'Reader note'});
  await expect(note).toContainText('A local official with legal authority');
  await expect(note.getByRole('button', {name: 'Look up “magistrate”'})).toBeVisible();
  await expect(phrase).toHaveClass(/is-open/);

  const phraseBox = (await phrase.boundingBox())!;
  const noteBox = (await note.boundingBox())!;
  expect(noteBox.width).toBe(340);
  // Under the phrase, from its left edge: the phrase itself stays uncovered.
  expect(noteBox.y).toBeGreaterThanOrEqual(phraseBox.y + phraseBox.height);
  expect(Math.abs(noteBox.x - phraseBox.x)).toBeLessThan(1);
  await page.screenshot({path: testInfo.outputPath('note-desktop.png'), animations: 'disabled'});

  // Another mark replaces the note; a phrase with more than one word has nothing to look up.
  await page.locator('.almonium-gloss', {hasText: 'in some degree'}).click();
  await expect(note).toContainText('To some extent');
  await expect(note.getByRole('button', {name: /Look up/})).toHaveCount(0);
  await expect(phrase).not.toHaveClass(/is-open/);

  await page.keyboard.press('Escape');
  await expect(note).toHaveCount(0);
});

test('near the bottom of the view the note opens above its phrase instead', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1280, height: 600});
  await openChapter(page);
  const phrase = page.locator('.almonium-gloss', {hasText: 'a magistrate'});
  await phrase.click();
  const note = page.getByRole('note', {name: 'Reader note'});
  await expect(note).toBeVisible();
  const phraseBox = (await phrase.boundingBox())!;
  const noteBox = (await note.boundingBox())!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(phraseBox.y);
  // The phrase wraps here; the note still starts where its last line does, over the column.
  const columnBox = (await page.locator('.reader-content').boundingBox())!;
  expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(columnBox.x + columnBox.width);
  await page.screenshot({path: testInfo.outputPath('note-desktop-above.png'), animations: 'disabled'});
});

test('on a phone the note is a short sheet that leaves its phrase in view', async ({page}, testInfo) => {
  await page.setViewportSize({width: 390, height: 844});
  await openChapter(page);
  const phrase = page.locator('.almonium-gloss', {hasText: 'a magistrate'});
  await phrase.click();
  const note = page.getByRole('note', {name: 'Reader note'});
  await expect(note).toBeVisible();
  const phraseBox = (await phrase.boundingBox())!;
  const noteBox = (await note.boundingBox())!;
  expect(noteBox.width).toBe(390);
  expect(noteBox.y + noteBox.height).toBeCloseTo(844, 0);
  expect(phraseBox.y + phraseBox.height).toBeLessThanOrEqual(noteBox.y);
  await page.screenshot({path: testInfo.outputPath('note-phone.png'), animations: 'disabled'});

  // Tapping the text closes it.
  await page.locator('.reader-content p').last().click();
  await expect(note).toHaveCount(0);
});
