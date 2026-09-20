import {expect, Page, test} from '@playwright/test';

// Which English, which German (design V): the row at onboarding and the column in Settings.
const learners = [
  {id: '01989f47-4c2a-7a10-9e5b-751983624a31', language: 'EN', selfReportedLevel: 'B2', active: true, variety: 'en-US'},
  {id: '01989f47-4c2a-7a10-9e5b-751983624a32', language: 'DE', selfReportedLevel: 'B1', active: true, variety: 'de-CH'},
  {id: '01989f47-4c2a-7a10-9e5b-751983624a33', language: 'IT', selfReportedLevel: 'A2', active: false, variety: null},
];
const user = (setupStep: string) => ({
  id: '01989f47-4c2a-7a10-9e5b-751983624a30', username: 'marta', email: 'marta@example.com', emailVerified: true, hidden: false, uiLang: 'en', avatarUrl: null, background: null,
  fluentLangs: ['UK'], setupStep, tags: [], premium: true, admin: false, interests: [], notifications: {socialEmails: true, bookEmails: true}, streamChatToken: 'token',
  subscription: {name: 'Premium', limits: {MAX_FLUENT_LANGS: 3, MAX_TARGET_LANGS: 10, MAX_ACTIVE_LANGS: 3}, type: 'MONTHLY', autoRenewal: true, startDate: '2026-01-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z'},
  learners,
  uiPreferences: {navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true}},
});
const policy = {
  allowance: 2, allowanceWithoutPlan: 1, nextSwitchAllowedAt: null,
  languages: learners.map(learner => ({language: learner.language, cefrLevel: learner.selfReportedLevel, wordsKept: 40, lastReadOn: null, active: learner.active, recommended: false})),
};

async function routeSignedIn(page: Page, setupStep: string, onLearnerPatch: (body: Record<string, unknown>) => void = () => undefined) {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('EN')));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/me')) await route.fulfill({json: user(setupStep)});
    else if (path.endsWith('/public/csrf/token')) await route.fulfill({body: 'token'});
    else if (path.endsWith('/info/languages/supported')) await route.fulfill({json: ['EN', 'DE', 'IT', 'FR', 'ES']});
    else if (path.endsWith('/learners/active-language-policy')) await route.fulfill({json: policy});
    else if (path.endsWith('/learners/DE') && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      onLearnerPatch(body);
      await route.fulfill({json: {...learners[1], ...body}});
    }
    else if (path.endsWith('/onboarding/levels')) await route.fulfill({json: {}});
    else if (path.endsWith('/public/plans')) await route.fulfill({json: []});
    else await route.fulfill({status: 404, json: {message: `Unexpected ${path}`}});
  });
}

test('the level step asks which English and which German, with the default chosen, and nothing for Italian', async ({page}, testInfo) => {
  await routeSignedIn(page, 'LEVEL');
  await page.goto('/onboarding');

  const questions = page.locator('.level-question');
  await expect(questions).toHaveCount(3);
  const english = questions.nth(0);
  await expect(english.locator('.variety-question')).toHaveText('Which English?');
  await expect(english.locator('.variety-pill')).toHaveText(['American', 'British', 'Australian', 'Indian']);
  await expect(english.locator('.variety-pill.selected')).toHaveText('American');
  await expect(english.locator('.variety-helper')).toHaveText('Sets the voice you hear, the spelling you see, and which meaning comes first. Every other variety stays one tap away.');
  // The row is read before the levels it qualifies.
  const rowBox = (await english.locator('.variety-row').boundingBox())!;
  const levelsBox = (await english.locator('.level-options').boundingBox())!;
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(levelsBox.y);

  const german = questions.nth(1);
  await expect(german.locator('.variety-pill')).toHaveText(['Germany', 'Austria', 'Switzerland']);
  await expect(german.locator('.variety-pill.selected')).toHaveText('Switzerland');
  await expect(questions.nth(2).locator('.variety-row')).toHaveCount(0);

  await english.locator('.variety-pill', {hasText: 'British'}).click();
  await expect(english.locator('.variety-pill.selected')).toHaveText('British');
  await page.screenshot({path: testInfo.outputPath('v1-level-step.png'), animations: 'disabled', fullPage: true});
});

test('settings shows the variety beside the level, frozen with a set-aside language, and saves a change on its own', async ({page}, testInfo) => {
  const patches: Record<string, unknown>[] = [];
  await routeSignedIn(page, 'COMPLETED', body => patches.push(body));
  await page.goto('/settings/lang');

  const rows = page.locator('.learner-record');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('.variety-trigger')).toHaveText('American');
  await expect(rows.nth(1).locator('.variety-trigger')).toHaveText('Switzerland');
  await expect(rows.nth(2).locator('.variety-trigger')).toHaveCount(0);
  await expect(rows.nth(2).locator('.variety-spacer')).toHaveCount(1);
  // The level of every row starts at the same x: the spacer holds the column for Italian.
  const levelX = await Promise.all([0, 1, 2].map(async index => (await rows.nth(index).locator('.level-trigger:not(.variety-trigger)').boundingBox())!.x));
  expect(new Set(levelX.map(Math.round)).size).toBe(1);

  await rows.nth(1).locator('.variety-trigger').click();
  const list = rows.nth(1).locator('.variety-list');
  await expect(list.locator('.level-option')).toHaveText(['GermanyGerman of Germany', 'AustriaAustrian German', 'SwitzerlandSwiss Standard German']);
  await expect(list.locator('.variety-helper')).toContainText('Dialect is not on offer');
  await page.screenshot({path: testInfo.outputPath('v4-settings-open.png'), animations: 'disabled'});

  await list.locator('.level-option', {hasText: 'Austria'}).click();
  await expect(rows.nth(1).locator('.variety-trigger')).toHaveText('Austria');
  await expect(rows.nth(1).locator('.level-trigger:not(.variety-trigger)')).toHaveText('B1');
  expect(patches).toEqual([{variety: 'de-AT'}]);
});
