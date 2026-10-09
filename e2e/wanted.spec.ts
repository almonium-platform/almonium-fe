import {expect, Page, test} from '@playwright/test';

// Wanted books (W1, W3, W4): a search the shelf cannot answer lists the catalogue's rows under it; a member wants
// one, the toast says its place in line, and the Wanted page shows the queue.
const book = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'dorian-gray-en', workSlug: 'the-picture-of-dorian-gray', title: 'The Picture of Dorian Gray', author: 'Oscar Wilde', language: 'EN', cefrLevel: 'C1', editionType: 'original', description: '', publicationYear: 1890, coverUrl: null, wordCount: 78000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []};
const dracula = {id: '01989f47-4c2a-7a10-9e5b-751983624a50', title: 'Dracula', originalTitle: null, originalLanguage: 'en', author: 'Bram Stoker', year: 1897, state: 'WANTABLE', workSlug: null, freeFrom: 1983, readers: 4, wantedByMe: false};
const user = {
  id: '01989f47-4c2a-7a10-9e5b-751983624a30', username: 'marta', email: 'marta@example.com', emailVerified: true, hidden: false, uiLang: 'en', avatarUrl: null, background: null,
  fluentLangs: ['UK'], setupStep: 'COMPLETED', tags: [], premium: true, admin: false, interests: [], notifications: {socialEmails: true, bookEmails: true}, streamChatToken: 'token',
  subscription: {name: 'Premium', limits: {MAX_FLUENT_LANGS: 3, MAX_BOOK_IMPORTS_ON_SHELF: 10}, type: 'MONTHLY', autoRenewal: true, startDate: '2026-01-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z'},
  learners: [{id: '01989f47-4c2a-7a10-9e5b-751983624a31', language: 'EN', selfReportedLevel: 'B1', active: true}],
  uiPreferences: {navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true}},
};
const wanted = {
  beingPrepared: [{catalogWorkId: '01989f47-4c2a-7a10-9e5b-751983624a51', title: 'Emma', author: 'Jane Austen', language: 'EN', workSlug: null, rank: 1, readers: 9, wantedByMe: false, status: 'IN_PROGRESS'}],
  queue: [
    {catalogWorkId: dracula.id, title: 'Dracula', author: 'Bram Stoker', language: 'EN', workSlug: null, rank: 2, readers: 5, wantedByMe: true, status: 'OPEN'},
    {catalogWorkId: '01989f47-4c2a-7a10-9e5b-751983624a52', title: 'Pan Tadeusz', author: 'Adam Mickiewicz', language: 'EN', workSlug: 'pan-tadeusz', rank: 3, readers: null, wantedByMe: false, status: 'OPEN'},
  ],
  recentlyArrived: [{catalogWorkId: '01989f47-4c2a-7a10-9e5b-751983624a53', title: 'Persuasion', author: 'Jane Austen', language: 'EN', editionSlug: 'persuasion-en-b2', cefrLevel: 'B2', coverUrl: null, arrivedAt: '2026-10-01T00:00:00Z'}],
  mineCount: 1,
};

async function routeSignedIn(page: Page, wants: string[]) {
  await page.addInitScript(() => {
    localStorage.setItem('current_language', JSON.stringify('EN'));
    localStorage.setItem('read_library_view', JSON.stringify('covers'));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/users/me')) await route.fulfill({json: user});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/books/language/EN')) await route.fulfill({json: {continueReading: [], available: [book], favorites: []}});
    else if (path.endsWith('/book-imports')) await route.fulfill({json: []});
    else if (path.endsWith('/book-imports/quota')) await route.fulfill({json: {limit: 10, used: 0}});
    else if (path.endsWith('/books/orders')) await route.fulfill({json: []});
    else if (path.endsWith('/books/orders/quota')) await route.fulfill({json: {limit: 3, used: 0, periodStartsAt: '2026-10-01T00:00:00Z', periodEndsAt: '2026-11-01T00:00:00Z'}});
    else if (path.endsWith('/public/plans')) await route.fulfill({json: []});
    else if (path.endsWith('/public/catalog/search')) await route.fulfill({json: [dracula]});
    else if (path.endsWith('/books/wants') && request.method() === 'POST') {
      wants.push(request.postData() ?? '');
      await route.fulfill({status: 201, json: {catalogWorkId: dracula.id, language: 'EN', rank: 2, readers: 5}});
    } else if (path.endsWith('/books/wanted')) await route.fulfill({json: wanted});
    else await route.fulfill({status: 404, json: {message: `Unexpected ${path}`}});
  });
}

test('a guest searching for a book the shelf lacks sees the catalogue row, and is asked to sign in to want it', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('read_library_view', JSON.stringify('covers')));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/public/books')) await route.fulfill({json: [book]});
    else if (path.endsWith('/public/catalog/search')) await route.fulfill({json: [dracula]});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });

  await page.goto('/read');
  const shelf = page.locator('.book-shelf--library');
  await expect(shelf.locator('.cover-book')).toHaveCount(1);
  // The Wanted page is for members: a guest's shelf has no foot line.
  await expect(shelf.locator('.ask-line')).toHaveCount(0);

  await page.getByPlaceholder('Title or author').fill('Dracula');
  await expect(shelf.locator('.ask-line--empty')).toHaveText('Nothing on the shelf for ‘Dracula’.');
  const row = page.locator('.catalog-row');
  await expect(row).toContainText('Dracula');
  await expect(row.locator('.catalog-readers')).toHaveText('4 readers');
  await row.getByRole('button', {name: 'I want this'}).click();
  await expect(row.getByRole('link', {name: 'Sign in to want this book.'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('w1-guest.png'), animations: 'disabled'});
});

test('a member wants a book from search, hears its place in line, and finds it on the Wanted page', async ({page}, testInfo) => {
  const wants: string[] = [];
  await routeSignedIn(page, wants);
  await page.goto('/read');
  const library = page.locator('.book-shelf--library');
  await library.locator('.shelf-end').scrollIntoViewIfNeeded();
  await expect(library.locator('.ask-line')).toHaveText('Missing a classic? Search for it and want it. Wanted');

  await page.getByPlaceholder('Title or author').fill('Dracula');
  const row = page.locator('.catalog-row');
  await row.getByRole('button', {name: 'I want this'}).click();
  expect(JSON.parse(wants[0])).toEqual({catalogWorkId: dracula.id, language: 'EN'});
  await expect(row.getByRole('button', {name: '✓ Wanted'})).toBeVisible();
  await expect(row.locator('.catalog-readers')).toHaveText('5 readers');
  const toast = page.locator('.wanted-toast');
  await expect(toast).toContainText('Added to Wanted. It’s 2nd in line.');
  await page.screenshot({path: testInfo.outputPath('w4-toast.png'), animations: 'disabled'});

  await toast.getByRole('link', {name: 'See the queue'}).click();
  await expect(page).toHaveURL(/\/read\/wanted$/);
  await expect(page.locator('h1')).toHaveText('Wanted');
  await expect(page.locator('.prepared-card')).toContainText('Being prepared');
  const rows = page.locator('.wanted-row');
  await expect(rows.nth(0)).toContainText('Dracula');
  await expect(rows.nth(0).locator('.wanted-row__rank')).toHaveText('2');
  await expect(rows.nth(1).locator('.wanted-meta')).toHaveText('Adam Mickiewicz · English edition');
  await expect(page.getByRole('button', {name: 'Yours · 1'})).toBeVisible();
  await expect(rows.nth(2).getByRole('link', {name: 'Read'})).toHaveAttribute('href', '/books/persuasion-en-b2');
  await page.screenshot({path: testInfo.outputPath('w3-wanted.png'), animations: 'disabled', fullPage: true});
});
