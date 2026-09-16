import {expect, test} from '@playwright/test';

const id = '01989f47-4c2a-7a10-9e5b-751983624a25';
const context = 'Two lanterns burned beside the door. Then it was dark.';
const book = {id, editionSlug: 'original-en', workSlug: 'book', title: 'Book', author: 'Author', language: 'EN', cefrLevel: 'B2', description: '', publicationYear: 1818, coverUrl: null, wordCount: 4000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: false, languageVariants: []};
const chapters = [
  {id, sequence: 11, title: 'CHAPTER V.', analysisStatus: 'complete', cefrEstimate: 'B2', descriptions: ['A long labour ends on a stormy night.']},
  {id: '01989f47-4c2a-7a10-9e5b-751983624a26', sequence: 12, title: 'CHAPTER VI.', analysisStatus: 'complete', cefrEstimate: 'C1', descriptions: ['A letter from Geneva brings news of home.']},
];
const text = `<section class="chapter"><h2 class="chapter-title" id="chapter-11">CHAPTER V.</h2><p>${context}</p></section>`
  + '<section class="chapter"><h2 class="chapter-title" id="chapter-12">CHAPTER VI.</h2><p>Clerval placed the letter in my hands.</p></section>';

test('a guest reads the chapter page, opens its words in the rail and meets the account ask on the card', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('current_language', JSON.stringify('DE')));
  let lookupContext = '';
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/public/books/original-en/chapters/11/vocabulary')) {
      await route.fulfill({json: {chapterId: id, chapterSequence: 11, language: 'en', status: 'ready', words: [{lemma: 'lantern', surface: 'lanterns', context, blockId: 'c11.p1'}]}});
    } else if (url.pathname.endsWith('/public/books/original-en/chapters')) {
      await route.fulfill({json: chapters});
    } else if (url.pathname.endsWith('/public/books/original-en/text')) {
      await route.fulfill({contentType: 'text/html', body: text});
    } else if (url.pathname.endsWith('/public/books/original-en')) {
      await route.fulfill({json: book});
    } else if (url.pathname.includes('/public/discover/lookup/EN/')) {
      lookupContext = url.searchParams.get('context') ?? '';
      await route.fulfill({json: {entry: 'lantern', sourceContext: lookupContext, language: 'EN', translationLanguage: 'UK', provider: 'fixture', frequency: null, senses: [{index: 1, headword: 'lantern', partOfSpeech: 'noun', transcription: null, translations: ['a lamp with a case']}]}});
    } else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });

  // The front door opens chapter 1 of the split, which is the first section: sequence 11.
  await page.goto('/reader/original-en');
  await expect(page).toHaveURL(/\/books\/original-en\/11/);
  await expect(page).toHaveTitle('Chapter V — Book (English, B2) · Almonium');
  const header = page.locator('.chapter-head');
  await expect(header).toContainText('Book · Author');
  await expect(header).toContainText('Chapter 1 of 2 · Estimated B2');
  await expect(header.locator('h1')).toHaveText('Chapter V');
  await expect(page.locator('.reader-content')).toContainText(context);

  // The chapter end carries the words, the next chapter and the one ask.
  const end = page.locator('.chapter-end');
  await expect(end.getByRole('region', {name: 'Words from this chapter'})).toContainText('1 of the book’s useful words occurs here.');
  await expect(end.locator('.vocab__excerpt')).toHaveText('Two lanterns burned beside the door.');
  await expect(end.locator('.chapter-end__link--next')).toContainText('Next · Estimated C1');
  await expect(end.locator('.chapter-end__link--next')).toContainText('A letter from Geneva');
  await expect(end.locator('.chapter-end__account')).toContainText('Your place is kept on this device');
  await page.screenshot({path: testInfo.outputPath('chapter-page.png'), animations: 'disabled'});

  // The bar's Words toggle opens the rail; a row becomes the card with a way back.
  await page.getByRole('button', {name: 'Words from this chapter'}).click();
  const rail = page.locator('.reader-rail');
  await expect(rail.getByRole('region', {name: 'Words from this chapter'})).toContainText('Chapter V');
  await expect(rail.locator('.vocab__form')).toHaveText('lanterns');
  await rail.locator('.vocab__row').click();
  await expect(rail.locator('.plate__word')).toHaveText('lantern');
  await expect(rail.locator('.plate__context mark')).toHaveText('lanterns');
  await expect(rail.locator('.plate__save')).toHaveText('Save to review — free account');
  await expect(rail.locator('.plate__hint')).toContainText('Keep 100 words, no card required.');
  await expect(rail.locator('.plate__fold')).toHaveCount(0);
  await expect.poll(() => lookupContext).toBe('Two lanterns burned beside the door.');
  await page.screenshot({path: testInfo.outputPath('word-card-guest.png'), animations: 'disabled'});
  await rail.getByRole('button', {name: 'Words'}).click();
  await expect(rail.locator('.vocab__row')).toHaveCount(1);

  // Turning the page keeps the book loaded and moves the header along.
  await end.locator('.chapter-end__link--next').click();
  await expect(page).toHaveURL(/\/books\/original-en\/12$/);
  await expect(header.locator('h1')).toHaveText('Chapter VI');
  await expect(page.locator('.reader-content')).toContainText('Clerval');
  await expect(end.locator('.chapter-end__link--previous')).toContainText('Chapter V');
});

test('the book page lists the contents with levels and links each row to its chapter', async ({page}, testInfo) => {
  const many = Array.from({length: 12}, (_, index) => ({id: `01989f47-4c2a-7a10-9e5b-7519836240${String(index).padStart(2, '0')}`, sequence: index + 1, title: `CHAPTER ${index + 1}.`, analysisStatus: index === 11 ? 'pending' : 'complete', cefrEstimate: index === 11 ? null : (index % 2 ? 'C1' : 'B2'), descriptions: index === 11 ? [] : [`What happens in chapter ${index + 1}.`]}));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/public/books/original-en/chapters')) await route.fulfill({json: many});
    else if (path.endsWith('/public/books/original-en')) await route.fulfill({json: book});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });
  await page.goto('/books/original-en');
  const contents = page.getByRole('region', {name: 'Contents'});
  await expect(contents).toContainText('12 chapters · estimated B2–C1');
  await expect(contents.locator('.contents__row')).toHaveCount(8);
  await expect(contents.locator('.contents__row').first()).toContainText('Chapter 1');
  await expect(contents.locator('.contents__row').first().locator('.contents__level')).toHaveText('B2');
  await expect(contents.locator('.contents__row').first()).toHaveAttribute('href', '/books/original-en/1');
  await expect(contents.locator('.contents__continue')).toHaveCount(0);
  await contents.getByRole('button', {name: 'All 12 chapters'}).click();
  await expect(contents.locator('.contents__row')).toHaveCount(12);
  await expect(contents.locator('.contents__row').last()).toContainText('Description on its way');
  await expect(contents.locator('.contents__row').last().locator('.contents__level')).toHaveText('–');
  await page.screenshot({path: testInfo.outputPath('book-contents.png'), fullPage: true, animations: 'disabled'});
});
