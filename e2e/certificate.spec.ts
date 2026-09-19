import {expect, test} from '@playwright/test';

// The book-completion certificate (design K): the public page, the moment at the end of the last chapter, and the
// finished book's tile on the shelf. Every request is answered here; nothing reaches a backend.
const bookId = '01989f47-4c2a-7a10-9e5b-751983624a25';
const words = ['Heffalump', 'Cunning Trap', 'wishing', 'sorrowful', 'hummed', 'tremendous', 'anxious', 'stoutness', 'expedition', 'crumbs', 'scuffle', 'plodding'];
const certificate = {username: 'marta', editionSlug: 'winnie-the-pooh', title: 'Winnie-the-Pooh', author: 'A. A. Milne', language: 'EN', words, wordsRead: 24610, wordsSaved: 187, finishedAt: '2026-09-18T10:00:00Z', publicPage: true};
const book = {id: bookId, editionSlug: 'winnie-the-pooh', workSlug: 'winnie-the-pooh', title: 'Winnie-the-Pooh', author: 'A. A. Milne', language: 'EN', cefrLevel: 'B1', editionType: 'original', description: '', publicationYear: 1926, coverUrl: null, wordCount: 24610, chapterCount: 2, progressPercentage: 40, currentChapter: 2, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []};
const chapters = [
  {id: bookId, sequence: 1, title: 'CHAPTER I.', analysisStatus: 'complete', cefrEstimate: 'B1', descriptions: ['In which we are introduced.']},
  {id: '01989f47-4c2a-7a10-9e5b-751983624a26', sequence: 2, title: 'CHAPTER X.', analysisStatus: 'complete', cefrEstimate: 'B1', descriptions: ['In which Christopher Robin gives a party.']},
];
const ending = 'So they went off together. But wherever they go, and whatever happens to them on the way, in that enchanted place on the top of the Forest a little boy and his Bear will always be playing.';
const text = '<section class="chapter"><h2 class="chapter-title" id="chapter-1">CHAPTER I.</h2><p>Here is Edward Bear, coming downstairs now.</p></section>'
  + `<section class="chapter"><h2 class="chapter-title" id="chapter-2">CHAPTER X.</h2>${'<p>They walked on, thinking of This and That.</p>'.repeat(40)}<p>${ending}</p></section>`;
const user = {
  id: '01989f47-4c2a-7a10-9e5b-751983624a30', username: 'marta', email: 'marta@example.com', emailVerified: true, hidden: false, uiLang: 'en', avatarUrl: null, background: null,
  fluentLangs: ['UK'], setupStep: 'COMPLETED', tags: [], premium: false, admin: false, interests: [], notifications: {socialEmails: true, bookEmails: true}, streamChatToken: 'token',
  subscription: {name: 'Free', limits: {MAX_FLUENT_LANGS: 1}, type: 'MONTHLY', autoRenewal: null, startDate: '2026-01-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z'},
  learners: [{id: '01989f47-4c2a-7a10-9e5b-751983624a31', language: 'EN', selfReportedLevel: 'B1', active: true}],
  uiPreferences: {navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true}},
};
// A one-pixel PNG stands in for the 1200×630 image; the download is what is checked, not the picture.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test('a stranger sees the certificate as the reader saw it, then one door into the book', async ({page}, testInfo) => {
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/public/certificates/marta/winnie-the-pooh')) await route.fulfill({json: certificate});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });

  await page.goto('/read/@marta/winnie-the-pooh');
  await expect(page).toHaveTitle('@marta read Winnie-the-Pooh in English · Almonium');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/read\/@marta\/winnie-the-pooh\/og\.png$/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', words.join(', '));

  const paper = page.locator('app-certificate-card');
  await expect(paper.locator('.eyebrow')).toHaveText('Read to the end');
  await expect(paper.locator('.title')).toHaveText('Winnie-the-Pooh');
  await expect(paper.locator('.byline')).toHaveText('A. A. Milne · English · read by @marta');
  await expect(paper.locator('.words__grid li')).toHaveCount(12);
  await expect(paper.locator('.counts')).toContainText('24,610 words read');
  await expect(paper.locator('.counts')).toContainText('187 saved');
  await expect(paper.locator('.counts')).toContainText('September 2026');

  // The marketing header, not the app nav: the visitor is signed out.
  await expect(page.getByRole('link', {name: 'Sign in'})).toBeVisible();
  await expect(page.locator('.door__copy')).toHaveText('The whole book is free to read, in English or beside a translation, with every word one tap from its meaning.');
  await expect(page.getByRole('link', {name: 'Read Winnie-the-Pooh'})).toHaveAttribute('href', '/reader/winnie-the-pooh');
  await expect(page.locator('.door__note')).toHaveText('Chapter 1 · no account needed');
  await page.screenshot({path: testInfo.outputPath('k1-public-page.png'), fullPage: true, animations: 'disabled'});

  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: testInfo.outputPath('k1-public-page-mobile.png'), fullPage: true, animations: 'disabled'});
});

test('a page the reader keeps off is the standard missing-page state at the same address', async ({page}) => {
  await page.route('**/api/v1/**', route => route.fulfill({status: 404, json: {success: false, message: 'No public certificate at that address'}}));

  await page.goto('/read/@marta/winnie-the-pooh');
  await expect(page.getByRole('heading', {level: 1, name: 'NOT FOUND'})).toBeVisible();
  await expect(page).toHaveURL(/\/read\/@marta\/winnie-the-pooh$/);
});

test('the last page, then the certificate, then the decision', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('EN')));
  const calls: string[] = [];
  let publicPage = true;
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/users/me')) await route.fulfill({json: user});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/public/books/winnie-the-pooh/chapters')) await route.fulfill({json: chapters});
    else if (path.endsWith('/public/books/winnie-the-pooh/text')) await route.fulfill({contentType: 'text/html', body: text});
    else if (path.endsWith('/public/books/winnie-the-pooh')) await route.fulfill({json: book});
    else if (path.includes('/vocabulary')) await route.fulfill({json: {chapterId: bookId, chapterSequence: 2, language: 'en', status: 'unavailable', words: []}});
    else if (path.endsWith(`/books/${bookId}`)) await route.fulfill({json: {progressPercentage: 40, language: 'EN', languageVariants: []}});
    else if (path.endsWith('/cards/lang/EN')) await route.fulfill({json: []});
    else if (path.endsWith('/certificate') && request.method() === 'POST') { calls.push('issue'); await route.fulfill({json: {...certificate, publicPage}}); }
    else if (path.endsWith('/certificate/visibility')) { publicPage = request.postDataJSON().publicPage; calls.push(`visibility:${publicPage}`); await route.fulfill({json: {...certificate, publicPage}}); }
    else if (path.endsWith('/certificate/image')) { calls.push('image'); await route.fulfill({contentType: 'image/png', body: png}); }
    else if (path.endsWith('/progress')) await route.fulfill({status: 204});
    else await route.fulfill({status: 404, json: {message: `Unexpected ${path}`}});
  });

  await page.goto('/books/winnie-the-pooh/2');
  await expect(page.locator('.chapter-head h1')).toHaveText('Chapter X');
  await expect(page.locator('app-certificate-moment')).toHaveCount(0);

  // Reaching the end of the last chapter is the signal: the certificate arrives under the final paragraph.
  const wrapper = page.locator('.reader-content-wrapper');
  await wrapper.evaluate(element => element.scrollTo(0, element.scrollHeight));
  const moment = page.getByRole('region', {name: 'Book finished'});
  await expect(moment.locator('.moment__end')).toHaveText('Chapter 2 of 2 · the end');
  await expect(moment.locator('app-certificate-card .title')).toHaveText('Winnie-the-Pooh');
  await expect.poll(() => calls).toEqual(['issue']);

  // The decision: the page is on, the address is there to copy, and the note says what is in review.
  const decision = moment.locator('.decision');
  await expect(decision.locator('.page-row__address')).toHaveText(/\/read\/@marta\/winnie-the-pooh$/);
  await expect(decision.getByRole('switch', {name: 'Public page'})).toHaveAttribute('aria-checked', 'true');
  await expect(decision.getByRole('button', {name: 'Copy link'})).toBeVisible();
  await expect(decision.locator('.actions__note')).toHaveText('187 words are in review');
  await expect(decision.getByRole('link', {name: 'Back to your books'})).toHaveAttribute('href', '/read');
  await moment.scrollIntoViewIfNeeded();
  await page.screenshot({path: testInfo.outputPath('k3-book-finished.png'), animations: 'disabled'});

  // Off: the link is gone with the page, and the line says so.
  await decision.getByRole('switch', {name: 'Public page'}).click();
  await expect(decision.getByRole('switch', {name: 'Public page'})).toHaveAttribute('aria-checked', 'false');
  await expect(decision.getByRole('button', {name: 'Copy link'})).toHaveCount(0);
  await expect(decision.locator('.page-row__off')).toContainText('Off: the link is not found by anyone');
  await expect.poll(() => calls).toEqual(['issue', 'visibility:false']);

  // Save as image downloads the PNG the link unfurls into.
  const download = page.waitForEvent('download');
  await decision.getByRole('button', {name: 'Save as image'}).click();
  expect((await download).suggestedFilename()).toBe('almonium-winnie-the-pooh.png');
  await expect.poll(() => calls).toEqual(['issue', 'visibility:false', 'image']);
});

test('a finished book on the shelf offers Read again and the certificate', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('EN')));
  const finished = {...book, progressPercentage: 100};
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/users/me')) await route.fulfill({json: user});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/books/language/EN')) await route.fulfill({json: {continueReading: [finished], available: [], favorites: []}});
    else if (path.endsWith('/public/books')) await route.fulfill({json: [finished]});
    else if (path.endsWith('/book-imports')) await route.fulfill({json: []});
    else if (path.endsWith('/book-imports/quota')) await route.fulfill({json: {limit: 10, used: 0}});
    else if (path.endsWith('/books/orders')) await route.fulfill({json: []});
    else if (path.endsWith('/books/orders/quota')) await route.fulfill({json: {limit: 1, used: 0, periodStartsAt: '2026-09-01T00:00:00Z', periodEndsAt: '2026-10-01T00:00:00Z'}});
    else if (path.endsWith('/public/plans')) await route.fulfill({json: []});
    else if (path.endsWith('/certificate') && request.method() === 'POST') await route.fulfill({json: certificate});
    else await route.fulfill({status: 404, json: {message: `Unexpected ${path}`}});
  });

  await page.goto('/read');
  const tile = page.locator('.continue-card--finished');
  await expect(tile).toHaveCount(1);
  await expect(tile.locator('.continue-foot small')).toHaveText('Read to the end');
  await expect(tile.locator('.progress-hairline i')).toHaveCSS('width', /px/);
  await expect(tile.locator('.continue-card__actions')).toHaveCSS('opacity', '0');
  await tile.hover();
  await expect(tile.locator('.continue-card__actions')).toHaveCSS('opacity', '1');
  await expect(tile.getByRole('link', {name: 'Read again'})).toHaveAttribute('href', '/books/winnie-the-pooh');
  await page.screenshot({path: testInfo.outputPath('k4-finished-tile.png'), animations: 'disabled'});

  // Certificate opens the moment's sheet, without the final paragraph.
  await tile.getByRole('button', {name: 'Certificate'}).click();
  const sheet = page.locator('.certificate-sheet');
  await expect(sheet.locator('app-certificate-card .title')).toHaveText('Winnie-the-Pooh');
  await expect(sheet.locator('.moment__end')).toHaveCount(0);
  await expect(sheet.getByRole('button', {name: 'Close'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('k4-certificate-sheet.png'), animations: 'disabled'});
  await sheet.getByRole('button', {name: 'Close'}).click();
  await expect(sheet).toHaveCount(0);
});
