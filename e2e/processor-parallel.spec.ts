import {expect, test} from '@playwright/test';

test('lists a full book in the contents rail, one line per chapter, describing only the current one', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1400, height: 1000});
  const id = '01989f47-4c2a-7a10-9e5b-751983624a25';
  const chapters = Array.from({length: 30}, (_, index) => ({id, sequence: index + 1, title: `Chapter ${index + 1}`, analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['A chapter description that needs several lines in the narrow contents list.']}));
  const metadata = {id, editionSlug: 'frankenstein-b2', workSlug: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', description: '', publicationYear: 1818, coverUrl: null, wordCount: 76000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: [], language: 'EN', cefrLevel: 'B2'};
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/frankenstein-b2/chapters')) await route.fulfill({json: chapters});
    else if (path.endsWith('/frankenstein-b2/text')) await route.fulfill({contentType: 'text/html', body: chapters.map(chapter => `<section class="chapter"><h2 id="chapter-${chapter.sequence}" class="chapter-title">${chapter.title}</h2><p>Chapter text.</p></section>`).join('')});
    else if (path.endsWith('/frankenstein-b2')) await route.fulfill({json: metadata});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });
  await page.goto('/reader/frankenstein-b2');
  await expect(page).toHaveURL(/\/books\/frankenstein-b2\/1\?resume=1$/);
  const contents = page.getByRole('navigation', {name: 'Contents'});
  const rows = contents.getByRole('link');
  await expect(rows).toHaveCount(30);
  await expect(rows.first()).toHaveAttribute('aria-current', 'page');
  await expect(rows.first().locator('.content-map__level')).toHaveText('B2');
  await expect(rows.first().locator('.content-map__description')).toBeVisible();
  await expect(rows.nth(1).locator('.content-map__description')).toBeHidden();
  await rows.nth(1).hover();
  await expect(rows.nth(1).locator('.content-map__description')).toBeVisible();
  expect(await contents.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  await rows.last().click();
  await expect(page).toHaveURL(/\/books\/frankenstein-b2\/30$/);
  await expect(page.locator('.chapter-head__place')).toContainText('Chapter 30 of 30');
  await page.screenshot({path: testInfo.outputPath('chapter-navigation.png'), fullPage: true, animations: 'disabled'});
});

for (const mode of ['side', 'inline', 'overlay']) {
for (const language of ['EN', 'UK']) {
test(`selects a ${language} companion and highlights sentence groups in ${mode} mode`, async ({page}, testInfo) => {
  await page.addInitScript(value => localStorage.setItem('parallel_mode', JSON.stringify(value)), mode);
  const primary = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'frankenstein-b2', language: 'EN', editionType: 'adaptation', cefrLevel: 'B2'};
  const original = {id: '01989f47-4c2a-7a10-9e5b-751983624a26', editionSlug: 'frankenstein-original', language, editionType: language === 'EN' ? 'original' : 'machine_translation', cefrLevel: 'C1', sourceEditionSlug: language === 'UK' ? 'source-original' : undefined};
  const metadata = {...primary, workSlug: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', description: 'Reader integration preview', publicationYear: 1818, coverUrl: null, wordCount: 76000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: true, languageVariants: [primary, original]};
  const html = '<section class="chapter"><h2 id="chapter-11" class="chapter-title">Chapter V</h2><p><span class="seg-pair"><span class="segment" data-side="primary" lang="en"><span class="aligned-sentence" role="button" tabindex="0" data-alignment="11-2-0">It was one in the morning.</span> <span class="aligned-sentence" role="button" tabindex="0" data-alignment="11-2-0">The rain fell.</span></span><span class="segment" data-side="secondary" lang="en"><span class="aligned-sentence" role="button" tabindex="0" data-alignment="11-2-0">It was already one in the morning; the rain pattered against the panes.</span></span></span></p></section>';
  let requestedPair = false;
  const companionText = language === 'UK' ? 'Була вже перша година ночі; дощ стукав у шибки.' : 'It was already one in the morning; the rain pattered against the panes.';
  const pairHtml = html.replace('It was already one in the morning; the rain pattered against the panes.', companionText)
    .replace('data-side="secondary" lang="en"', `data-side="secondary" lang="${language.toLowerCase()}"`);
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/public/books/frankenstein-b2/parallel-edition/frankenstein-original')) {
      requestedPair = true;
      await route.fulfill({contentType: 'text/html', body: pairHtml});
    } else if (path.endsWith('/public/books/frankenstein-b2/chapters')) {
      await route.fulfill({json: [{id: primary.id, sequence: 11, title: 'Chapter V', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['A scientist faces an unexpected result.']}]});
    } else if (path.endsWith('/public/books/frankenstein-b2/text')) {
      // Exercise the slow base-response race: it must not replace the loaded pair.
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({contentType: 'text/html', body: '<section class="chapter"><h2 class="chapter-title" id="chapter-11">V</h2><p>Base text</p></section>'});
    } else if (path.endsWith('/public/books/frankenstein-b2')) {
      await route.fulfill({json: metadata});
    } else {
      await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
    }
  });
  await page.goto('/reader/frankenstein-b2?parallel=frankenstein-original');
  const primaryPane = mode === 'side' ? page.locator('.sbs-column-main').last() : page.locator('.reader-content span.segment[data-side="primary"]');
  const companionPane = mode === 'side' ? page.locator('.sbs-column-secondary').last() : page.locator('.reader-content span.segment[data-side="secondary"]');
  await expect(primaryPane).toContainText('The rain fell.');
  await expect(companionPane).toContainText(companionText);
  expect(requestedPair).toBeTruthy();
  await primaryPane.locator('.aligned-sentence').first().click();
  await expect(page.locator('.is-aligned-current')).toHaveCount(3);
  await companionPane.locator('.aligned-sentence').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.is-aligned-current')).toHaveCount(3);
  await expect(page.locator('.parallel-provenance').first()).toContainText(`C1 · ${language === 'EN' ? 'original' : 'machine translation'}`);
  if (language === 'UK') {
    await expect(page.locator('.parallel-provenance').first()).toContainText('not this adaptation');
  }
  await page.screenshot({path: testInfo.outputPath(`parallel-${language}-${mode}.png`), fullPage: true});
  await expect(page.locator('.chapter-head__place')).toContainText('Chapter 1 of 1 · Estimated B2');
  await expect(page.locator('.chapter-head__description')).toContainText('A scientist faces an unexpected result.');
  if (language === 'UK') {
    await page.locator('app-parallel-translation').click();
    const toggle = page.getByRole('switch', {name: 'Include translations of other editions:'});
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({path: testInfo.outputPath(`companion-switch-${mode}-on.png`), fullPage: true, animations: 'disabled'});
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.parallel-provenance')).toHaveCount(0);
    await page.screenshot({path: testInfo.outputPath(`companion-switch-${mode}-off.png`), fullPage: true, animations: 'disabled'});
  }
});
}
}
