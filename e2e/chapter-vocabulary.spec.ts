import {expect, test} from '@playwright/test';

test('takes attested chapter vocabulary into Discover with its book context', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('DE')));
  const id = '01989f47-4c2a-7a10-9e5b-751983624a25';
  const context = 'Two lanterns burned beside the door.';
  let lookupContext = '';
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/public/books/original-en/chapters/11/vocabulary')) {
      await route.fulfill({json: {chapterId: id, chapterSequence: 11, language: 'en', status: 'ready', words: [{lemma: 'lantern', surface: 'lanterns', context, blockId: 'c11.p1'}]}});
    } else if (url.pathname.endsWith('/public/books/original-en/chapters')) {
      await route.fulfill({json: [{id, sequence: 11, title: 'Chapter V', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: []}]});
    } else if (url.pathname.endsWith('/public/books/original-en/text')) {
      await route.fulfill({contentType: 'text/html', body: `<section class="chapter"><h2 class="chapter-title" id="chapter-11">Chapter V</h2><p>${context}</p></section>`});
    } else if (url.pathname.endsWith('/public/books/original-en')) {
      await route.fulfill({json: {id, editionSlug: 'original-en', workSlug: 'book', title: 'Book', author: 'Author', language: 'EN', cefrLevel: 'B2', description: '', publicationYear: 1818, coverUrl: null, wordCount: 4000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []}});
    } else if (url.pathname.includes('/public/discover/lookup/EN/')) {
      lookupContext = url.searchParams.get('context') ?? '';
      await route.fulfill({json: {entry: 'lantern', sourceContext: lookupContext, language: 'EN', translationLanguage: 'UK', provider: 'fixture', frequency: null, senses: []}});
    } else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });
  await page.goto('/reader/original-en');
  await page.getByRole('button', {name: 'Vocabulary', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Chapter vocabulary'})).toContainText(context);
  await expect(page.getByRole('region', {name: 'Chapter vocabulary'})).toContainText('In the text: lanterns');
  await page.screenshot({path: testInfo.outputPath('chapter-vocabulary.png'), animations: 'disabled'});
  await page.getByRole('link', {name: 'Look up lantern in Discover'}).click();
  await expect(page).toHaveURL(/\/discover\?.*chapter=11/);
  await expect(page.getByRole('complementary', {name: 'Book source'})).toContainText('Book · Chapter V');
  await expect(page.locator('#discover-search')).toHaveValue('lantern');
  await expect.poll(() => lookupContext).toBe(context);
  await page.screenshot({path: testInfo.outputPath('discover-book-context.png'), animations: 'disabled'});
});
