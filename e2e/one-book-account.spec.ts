import {expect, Page, test} from '@playwright/test';

// The one-book account (G21): what the shelf shows before there is a shelf.
const book = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'frankenstein-en-b2', workSlug: 'frankenstein', title: 'Frankenstein; or, the Modern Prometheus', author: 'Mary Shelley', language: 'EN', cefrLevel: 'B2', editionType: 'adaptation', description: '', publicationYear: 1818, coverUrl: null, wordCount: 76295, chapterCount: 24, progressPercentage: 26, currentChapter: 7, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []};
const user = {
  id: '01989f47-4c2a-7a10-9e5b-751983624a30', username: 'marta', email: 'marta@example.com', emailVerified: true, hidden: false, uiLang: 'en', avatarUrl: null, background: null,
  fluentLangs: ['UK'], setupStep: 'COMPLETED', tags: [], premium: true, admin: false, interests: [], notifications: {socialEmails: true, bookEmails: true}, streamChatToken: 'token',
  subscription: {name: 'Premium', limits: {MAX_FLUENT_LANGS: 3, MAX_BOOK_IMPORTS_ON_SHELF: 10}, type: 'MONTHLY', autoRenewal: true, startDate: '2026-01-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z'},
  learners: [{id: '01989f47-4c2a-7a10-9e5b-751983624a31', language: 'EN', selfReportedLevel: 'B1', active: true}],
  uiPreferences: {navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true}},
};
const readyOrder = {id: '01989f47-4c2a-7a10-9e5b-751983624a40', bookId: book.id, bookTitle: book.title, bookEditionSlug: book.editionSlug, language: 'UK', status: 'READY', createdAt: '2026-08-12T10:00:00Z', seenAt: '2026-09-01T10:00:00Z'};

async function routeSignedIn(page: Page, shelf: {continueReading: object[]; available: object[]}, orders: object[] = []) {
  await page.addInitScript(() => {
    localStorage.setItem('current_language', JSON.stringify('EN'));
    localStorage.setItem('read_library_view', JSON.stringify('covers'));
  });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/me')) await route.fulfill({json: user});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/books/language/EN')) await route.fulfill({json: {...shelf, favorites: []}});
    else if (path.endsWith('/book-imports')) await route.fulfill({json: []});
    else if (path.endsWith('/book-imports/quota')) await route.fulfill({json: {limit: 10, used: 0}});
    else if (path.endsWith('/books/orders')) await route.fulfill({json: orders});
    else if (path.endsWith('/books/orders/quota')) await route.fulfill({json: {limit: 3, used: 1, periodStartsAt: '2026-09-01T00:00:00Z', periodEndsAt: '2026-10-01T00:00:00Z'}});
    else if (path.endsWith('/public/plans')) await route.fulfill({json: []});
    else await route.fulfill({status: 404, json: {message: `Unexpected ${path}`}});
  });
}

test('one open book stands in Continue and on the Library shelf, and nothing else renders', async ({page}, testInfo) => {
  await routeSignedIn(page, {continueReading: [book], available: []}, [readyOrder]);
  await page.goto('/read');

  // Continue is a shortcut into the shelf, not a partition of it: the book appears twice.
  await expect(page.locator('.continue-card')).toHaveCount(1);
  const library = page.locator('.book-shelf--library');
  await expect(library.locator('.cover-book')).toHaveCount(1);
  await expect(library.locator('.kicker')).toHaveText('Library · 1');
  // The foot line waits for the reader to reach the end of the shelf, which here is below the fold.
  await library.locator('.shelf-end').scrollIntoViewIfNeeded();
  await expect(library.locator('.ask-line')).toHaveText('Missing a classic? Ask for a book');

  // Gone against the old build: the header counter, the Yours shelf, the Clear filters button, the requests card.
  await expect(page.locator('.read-header .quota')).toHaveCount(0);
  await expect(page.locator('.book-shelf--yours')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Clear filters'})).toHaveCount(0);
  await expect(page.locator('.requests-card')).toHaveCount(0);
  await expect(page.locator('.notice-card')).toHaveCount(0);

  // The shelves come in the order Continue, Library.
  const kickers = await page.locator('.kicker').allTextContents();
  expect(kickers.map(text => text.trim().split(' ')[0])).toEqual(['Continue', 'Library']);
  await page.screenshot({path: testInfo.outputPath('g21-one-book.png'), animations: 'disabled', fullPage: true});
});

test('filters that empty the shelf leave one line with Clear filters; a catalogue with nothing leaves Almo searching', async ({page}, testInfo) => {
  await routeSignedIn(page, {continueReading: [], available: [book]});
  await page.goto('/read');
  const library = page.locator('.book-shelf--library');
  await expect(library.locator('.cover-book')).toHaveCount(1);

  await page.locator('.filter-bar select').first().selectOption('C1');
  await page.getByRole('button', {name: 'Parallel text'}).click();
  const empty = library.locator('.ask-line--empty');
  await expect(empty).toHaveText('Nothing at C1 with parallel text. Clear filters');
  await expect(library.locator('.kicker')).toHaveText('Library');
  await page.screenshot({path: testInfo.outputPath('g18-empty-filters.png'), animations: 'disabled'});
  await empty.getByRole('button', {name: 'Clear filters'}).click();
  await expect(library.locator('.cover-book')).toHaveCount(1);
  await expect(page.getByRole('button', {name: 'Translations'})).toHaveAttribute('aria-pressed', 'true');
});

test('a shelf language with no books yet shows Almo searching and one ask line, not the foot line twice', async ({page}, testInfo) => {
  await routeSignedIn(page, {continueReading: [], available: []});
  await page.goto('/read');
  const library = page.locator('.book-shelf--library');
  await expect(library.locator('.almo-empty__pose')).toBeVisible();
  await expect(library.locator('.almo-empty .ask-line')).toHaveText('Nothing in English yet. Ask for a book.');
  await expect(library.locator('.ask-line')).toHaveCount(1);
  await expect(page.getByRole('button', {name: 'Clear filters'})).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('g21-empty-catalogue.png'), animations: 'disabled'});
});
