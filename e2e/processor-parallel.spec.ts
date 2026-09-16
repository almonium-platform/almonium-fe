import {expect, test} from '@playwright/test';

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
      await route.fulfill({contentType: 'text/html', body: '<section class="chapter"><h2 class="chapter-title">V</h2><p>Base text</p></section>'});
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
  await page.getByRole('button', {name: 'Open chapter navigation'}).click();
  await expect(page.getByRole('menuitem').filter({hasText: 'Estimated B2'})).toContainText('A scientist faces an unexpected result.');
  if (language === 'UK') {
    await page.keyboard.press('Escape');
    await page.locator('app-parallel-translation').click();
    const toggle = page.getByRole('switch', {name: 'Include translations of other editions:'});
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.parallel-provenance')).toHaveCount(0);
  }
});
}
}
