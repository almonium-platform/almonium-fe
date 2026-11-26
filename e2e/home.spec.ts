import {expect, Page, test} from '@playwright/test';

// Home 3a: only the book is a card; the words, the shelf, the count, the record and the plan sit on the ground.
const book = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'frankenstein-en-b2', workSlug: 'frankenstein', title: 'Frankenstein; or, the Modern Prometheus', author: 'Mary Shelley', language: 'EN', cefrLevel: 'B2', editionType: 'adaptation', description: '', publicationYear: 1818, coverUrl: null, wordCount: 76295, chapterCount: 24, progressPercentage: 26, currentChapter: 7, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []};
const user = {
  id: '01989f47-4c2a-7a10-9e5b-751983624a30', username: 'marta', email: 'marta@example.com', emailVerified: true, hidden: false, uiLang: 'en', avatarUrl: null, background: null,
  fluentLangs: ['UK'], setupStep: 'COMPLETED', tags: [], premium: false, admin: false, interests: [], notifications: {socialEmails: true, bookEmails: true}, streamChatToken: 'token',
  subscription: {name: 'FREE', limits: {MAX_FLUENT_LANGS: 1}, type: 'LIFETIME', autoRenewal: false, startDate: '2026-01-01T00:00:00Z', endDate: null},
  learners: [{id: '01989f47-4c2a-7a10-9e5b-751983624a31', language: 'EN', selfReportedLevel: 'B1', active: true}],
  uiPreferences: {navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true}},
};
// Two kept inside the last week and two long before it, so the heading counts the week and the link the lot.
const daysAgo = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
const cards = ['to abandon', 'wretched', 'to sit up', 'monstrous'].map((entry, index) => ({
  id: `01989f47-4c2a-7a10-9e5b-75198362500${index}`, entry, language: 'EN', createdAt: daysAgo([1, 3, 40, 60][index]),
  partOfSpeech: index === 1 ? 'ADJECTIVE' : undefined, itemType: index === 2 ? 'CHUNK' : 'WORD',
  sourceContext: index === 1 ? 'I, the miserable and the abandoned, am a wretched thing.' : undefined,
  learningIntents: index === 0 ? ['UNDERSTAND', 'PRODUCE'] : ['UNDERSTAND'], iteration: index === 3 ? 6 : 0,
  translations: [{id: `t${index}`, translation: ['покидати', 'нещасний', 'підвестися', 'жахливий'][index]}],
  examples: [{id: `e${index}`, example: `He did not want ${entry} in that room.`, translation: ''}],
  tags: [{text: 'verb'}],
}));
const week = (index: number) => {
  const start = new Date(Date.UTC(2026, 8, 7 + index * 7));
  const met = index % 5 !== 2;
  return {weekStart: start.toISOString().slice(0, 10), daysMet: met ? 2 : 0, met, frozen: false, days: Array.from({length: 7}, (_, day) => ({date: new Date(start.getTime() + day * 864e5).toISOString().slice(0, 10), minutes: met && day < 2 ? 10 + index * 3 : 0, met: met && day < 2}))};
};
const rhythm = {languages: [{language: 'EN', target: 2, editable: true, startedAt: '2026-06-01T00:00:00Z', setAsideAt: null, firstSessionAt: '2026-06-02', frozenPace: null, weeks: Array.from({length: 12}, (_, index) => week(index))}]};

async function routeHome(page: Page, shelf: {continueReading: object[]; available: object[]}, saved: object[]) {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('EN')));
  await page.route(/(api\.almonium\.com|localhost:9998)\/v1\//, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/me')) await route.fulfill({json: user});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/books/language/EN')) await route.fulfill({json: {...shelf, favorites: []}});
    else if (/\/cards\/.*EN$/.test(path)) await route.fulfill({json: saved});
    else if (path.endsWith('/summary/EN')) await route.fulfill({json: {dueCount: 23, sessionSize: 20, understandCount: 10, produceCount: 8, disambiguateCount: 5, leechCount: 0, leeches: []}});
    else if (path.endsWith('/rhythm')) await route.fulfill({json: rhythm});
    else await route.fulfill({status: 404, json: {message: `Unexpected ${path}`}});
  });
}

const paints = (locator: ReturnType<Page['locator']>) => locator.evaluate(element => {
  const style = getComputedStyle(element);
  return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.boxShadow !== 'none';
});

for (const width of [1360, 390]) {
  test(`a returning reader's home keeps the book as its only card at ${width}px`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height: 1000});
    await routeHome(page, {continueReading: [book], available: []}, cards);
    await page.goto('/home');

    await expect(page.getByRole('heading', {level: 1})).toHaveText(book.title);
    await expect(page.locator('.word-row')).toHaveCount(4);
    // The words speak for the week, name the sentence they were met in and say what each is being learned for.
    await expect(page.locator('#kept-title')).toHaveText('Two words this week');
    await expect(page.locator('.kept-card .card-heading a')).toHaveText('All 4 words');
    const wretched = page.locator('.word-row').filter({hasText: 'wretched'}).first();
    await expect(wretched.locator('.word-name small')).toHaveText('adjective');
    await expect(wretched.locator('q')).toHaveText('I, the miserable and the abandoned, am a wretched thing.');
    await expect(wretched.locator('q mark')).toHaveText('wretched');
    await expect(wretched.locator('.word-detail small')).toHaveText(/^Kept \p{L}+day$/u);
    await expect(page.locator('.word-note')).toHaveText(['say it too', 'understand only', 'understand only', 'seen 6 times']);
    await expect(page.locator('.review-card .section-label')).toHaveText('Due today');
    await expect(page.locator('.plan-card p').nth(1)).toHaveText('Free covers one language and 100 saved words. You have kept 4, all in English.');
    await expect(page.locator('.review-count strong')).toHaveText('23');
    await expect(page.locator('app-harness .week')).toHaveCount(12);

    expect(await paints(page.locator('.continue-card'))).toBe(true);
    for (const block of ['.kept-card', '.shelf-card', '.review-card', '.plan-card', 'app-harness .record']) {
      expect(await paints(page.locator(block)), block).toBe(false);
    }
    // On a desktop the right column is a ledger behind a vertical rule; on a phone it stacks under a horizontal one.
    const rule = await page.locator('.side-column').evaluate(element => ({left: getComputedStyle(element).borderLeftWidth, top: getComputedStyle(element).borderTopWidth}));
    expect(rule).toEqual(width > 980 ? {left: '1px', top: '0px'} : {left: '0px', top: '1px'});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: testInfo.outputPath(`home-${width}.png`), animations: 'disabled', fullPage: true});
  });
}

test('a new reader sees Almo searching, a place to start and an empty ledger', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1360, height: 1000});
  await routeHome(page, {continueReading: [], available: [book]}, []);
  await page.goto('/home');

  await expect(page.getByRole('heading', {level: 1})).toHaveText('Start with one page');
  await expect(page.locator('.almo-greeting img')).toHaveAttribute('src', /searching/);
  await expect(page.locator('.review-count strong')).toHaveText('0');
  expect(await paints(page.locator('.empty-hero'))).toBe(true);
  expect(await paints(page.locator('.suggestions'))).toBe(false);
  await page.screenshot({path: testInfo.outputPath('home-empty.png'), animations: 'disabled', fullPage: true});
});
