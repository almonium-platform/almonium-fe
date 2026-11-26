import {expect, Page, test} from '@playwright/test';

// A flag on a dictionary sense or word (design: user reports), and the /ops queue it lands in.
const learners = [{id: '01989f47-4c2a-7a10-9e5b-751983624a32', language: 'DE', selfReportedLevel: 'B1', active: true, variety: 'de-DE'}];
const user = (admin: boolean) => ({
  id: '01989f47-4c2a-7a10-9e5b-751983624a30', username: 'marta', email: 'marta@example.com', emailVerified: true, hidden: false, uiLang: 'en', avatarUrl: null, background: null,
  fluentLangs: ['EN'], setupStep: 'COMPLETED', tags: [], premium: true, admin, interests: [], notifications: {socialEmails: true, bookEmails: true}, streamChatToken: 'token',
  subscription: {name: 'Premium', limits: {MAX_FLUENT_LANGS: 3, MAX_TARGET_LANGS: 10, MAX_ACTIVE_LANGS: 3}, type: 'MONTHLY', autoRenewal: true, startDate: '2026-01-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z'},
  learners,
  uiPreferences: {navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true}},
});
const lookup = {
  entry: 'Haus', sourceContext: 'Das Haus am Ende der Straße ist alt.', language: 'DE', translationLanguage: 'EN', provider: 'lexicon',
  frequency: {score: 5.41, band: 'Very common', provenance: 'wordfreq'}, pronunciations: [], homophones: [],
  senses: [
    {index: 1, key: 'ceb2c5ca-7399-416f-b982-09ae31eb0819', headword: 'Haus', partOfSpeech: 'noun', transcription: 'haʊ̯s', translations: ['house', 'building'],
      definition: 'ein Gebäude, in dem Menschen wohnen', cefr: 'A1', examples: [{text: 'Das Haus ist alt.', translation: 'The house is old.'}]},
    {index: 2, key: '7427375c-a387-4d1c-8620-9cb1237d8f42', headword: 'Haus', partOfSpeech: 'noun', transcription: 'haʊ̯s', translations: ['home'],
      definition: 'der Ort, wo jemand mit seiner Familie lebt', cefr: 'A1', examples: []},
  ],
};
const queue = [
  {language: 'DE', headword: 'Haus', senseKey: lookup.senses[1].key, definition: lookup.senses[1].definition, reason: 'WRONG_SENSE', reports: 3, reporters: 2,
    zipf: 5.41, entryVersion: 5, currentVersion: 5, firstAt: '2026-11-16T09:00:00Z', lastAt: '2026-11-17T21:40:00Z',
    items: [{comment: 'Here it is the building, not home.', context: lookup.sourceContext, book: 'kafka-de', entryVersion: 5, createdAt: '2026-11-17T21:40:00Z'}]},
  {language: 'DE', headword: 'Kerl', senseKey: null, definition: null, reason: 'WRONG_SOUND', reports: 1, reporters: 1,
    zipf: 3.9, entryVersion: 2, currentVersion: 3, firstAt: '2026-11-15T09:00:00Z', lastAt: '2026-11-15T09:00:00Z',
    items: [{comment: null, context: null, book: null, entryVersion: 2, createdAt: '2026-11-15T09:00:00Z'}]},
];

async function routeSignedIn(page: Page, admin: boolean, reports: unknown[]) {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('DE')));
  await page.route(/(api\.almonium\.com|localhost:9998)\/v1\//, async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/users/me')) await route.fulfill({json: user(admin)});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/info/languages/supported')) await route.fulfill({json: ['EN', 'DE']});
    else if (path.includes('/public/discover/lookup/')) await route.fulfill({json: lookup});
    else if (path.endsWith('/lexicon/reports') && method === 'POST') {
      reports.push(route.request().postDataJSON());
      await route.fulfill({status: 201, json: {id: 'report-1'}});
    }
    else if (path.endsWith('/ops/lexicon/reports')) await route.fulfill({json: queue});
    else if (path.includes('/cards')) await route.fulfill({json: []});
    else await route.fulfill({status: 404, json: {message: `Unexpected ${path}`}});
  });
}

test('a reader flags a sense with a reason, and the report carries its key, the sentence and the book', async ({page}, testInfo) => {
  const reports: unknown[] = [];
  await routeSignedIn(page, false, reports);
  await page.goto(`/discover/de?text=Haus&context=${encodeURIComponent(lookup.sourceContext)}&book=kafka-de`);

  const senses = page.locator('.sense');
  await expect(senses).toHaveCount(2);
  await senses.nth(1).click();
  await senses.nth(1).locator('button.flag').click();
  const panel = senses.nth(1).locator('app-entry-report');
  await expect(panel.locator('legend')).toHaveText('What is wrong with sense 2 of “Haus”?');
  await expect(panel.locator('.report__reason')).toHaveText(['Doesn’t fit this sentence', 'Wrong definition', 'Wrong form or grammar', 'Wrong sound', 'Bad example']);
  await expect(panel.locator('.report__send')).toBeDisabled();
  await expect(panel.locator('.report__hint')).toHaveText('Pick what is wrong to send it.');
  await page.screenshot({path: testInfo.outputPath('r1-sense-panel.png'), animations: 'disabled', fullPage: true});

  await panel.locator('.report__reason', {hasText: 'Doesn’t fit this sentence'}).click();
  await panel.locator('textarea').fill('Here it is the building, not home.');
  await panel.locator('.report__send').click();
  await expect(panel.locator('.report__thanks')).toBeVisible();
  expect(reports).toEqual([{
    language: 'DE', headword: 'Haus', senseKey: lookup.senses[1].key, reason: 'WRONG_SENSE', comment: 'Here it is the building, not home.',
    context: lookup.sourceContext, book: 'kafka-de',
  }]);
  await page.screenshot({path: testInfo.outputPath('r2-sent.png'), animations: 'disabled', fullPage: true});

  await page.locator('button.word-flag').click();
  await expect(page.locator('.entry-header app-entry-report legend')).toHaveText('What is wrong with “Haus”?');
  await page.screenshot({path: testInfo.outputPath('r3-word-panel.png'), animations: 'disabled', fullPage: true});
});

test('the ops queue shows one row per sense and reason, opening onto the sentence and the note', async ({page}, testInfo) => {
  await routeSignedIn(page, true, []);
  await page.goto('/ops');
  const card = page.locator('app-ops-entry-reports');
  await expect(card.locator('tbody tr')).toHaveCount(2);
  await card.locator('.ops-reports__toggle').first().click();
  await expect(card.locator('.ops-reports__items')).toContainText('Here it is the building, not home.');
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({path: testInfo.outputPath('r4-ops.png'), animations: 'disabled'});
});
