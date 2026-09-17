import {expect, test} from '@playwright/test';

// One work, three editions (G14): the original, a B2 adaptation and a Ukrainian translation of the original.
const original = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'frankenstein-en-c1', workSlug: 'frankenstein', title: 'Frankenstein; or, The Modern Prometheus', author: 'Mary Shelley', language: 'EN', cefrLevel: 'C1', editionType: 'original', description: 'A scientist gives life to a creature.', publicationYear: 1818, coverUrl: null, wordCount: 77706, progressPercentage: null, isTranslation: false, hasTranslation: true, hasParallelTranslation: true};
const adapted = {...original, id: '01989f47-4c2a-7a10-9e5b-751983624a26', editionSlug: 'frankenstein-en-b2', cefrLevel: 'B2', editionType: 'adaptation', wordCount: 76295};
const ukrainian = {...original, id: '01989f47-4c2a-7a10-9e5b-751983624a27', editionSlug: 'frankenstein-uk-b2', title: 'Франкенштейн, або Сучасний Прометей', author: 'Мері Шеллі', language: 'UK', cefrLevel: 'B2', editionType: 'machine_translation', isTranslation: true, wordCount: 63656};
const lisova = {...original, id: '01989f47-4c2a-7a10-9e5b-751983624a28', editionSlug: 'lisova-pisnya-uk', workSlug: 'lisova-pisnya', title: 'Лісова пісня', author: 'Леся Українка', language: 'UK', cefrLevel: 'C1', hasTranslation: false, hasParallelTranslation: false, wordCount: 30000};

const variants = [
  {id: original.id, editionSlug: original.editionSlug, language: 'EN', editionType: 'original', cefrLevel: 'C1', sourceEditionSlug: null},
  {id: adapted.id, editionSlug: adapted.editionSlug, language: 'EN', editionType: 'adaptation', cefrLevel: 'B2', sourceEditionSlug: original.editionSlug},
  {id: ukrainian.id, editionSlug: ukrainian.editionSlug, language: 'UK', editionType: 'machine_translation', cefrLevel: 'B2', sourceEditionSlug: original.editionSlug},
];

test('the library shows a work once per language and a guest tile opens the original', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('read_library_view', JSON.stringify('covers')));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/public/books')) await route.fulfill({json: [adapted, ukrainian, original, lisova]});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });

  await page.goto('/read');
  const shelf = page.locator('.book-shelf').last();
  await expect(shelf.locator('.kicker__count')).toHaveText('· 3');
  const tiles = shelf.locator('.cover-book');
  await expect(tiles).toHaveCount(3);

  // Four editions, three tiles: the English tile is one, and it opens the original for a guest.
  const english = tiles.filter({hasText: 'Mary Shelley'});
  await expect(english).toHaveCount(1);
  await expect(english).toHaveAttribute('href', '/books/frankenstein-en-c1');
  await expect(english.locator('small')).toHaveText('Mary Shelley · C1');

  // The translated edition is titled in its own language, and the caption says so in one word.
  const translated = tiles.filter({hasText: 'Франкенштейн'});
  await expect(translated.locator('small')).toHaveText('Мері Шеллі · B2 · Translation');
  await expect(tiles.filter({hasText: 'Лісова пісня'}).locator('small')).toHaveText('Леся Українка · C1');
  await page.screenshot({path: testInfo.outputPath('library-works.png'), animations: 'disabled'});

  // The level filter changes which edition the same tile opens; it never adds a tile.
  await page.locator('.filter-bar select').first().selectOption('B2');
  await expect(tiles).toHaveCount(2);
  await expect(tiles.filter({hasText: 'Mary Shelley'})).toHaveAttribute('href', '/books/frankenstein-en-b2');
  await expect(tiles.filter({hasText: 'Mary Shelley'}).locator('small')).toHaveText('Mary Shelley · B2');

  // Spines carry the same caption in the hover label.
  await page.getByRole('group', {name: 'Library view'}).getByRole('button', {name: 'Spines'}).click();
  const spine = shelf.locator('.book-spine').filter({hasText: 'Франкенштейн'});
  await spine.hover();
  await expect(spine.locator('.hover-label small')).toHaveText('Мері Шеллі · 255 pp · B2 · Translation');
  await page.screenshot({path: testInfo.outputPath('library-spines.png'), animations: 'disabled'});
});

test('the book page lists same-language editions in an Edition row and other languages as parallel text', async ({page}, testInfo) => {
  // A place kept on this device in the original: its chip carries a hairline.
  await page.addInitScript(() => localStorage.setItem('reader_positions', JSON.stringify({
    'guest:public:frankenstein-en-c1': {version: 2, chapter: 3, presentation: 'p', scrollTop: 0, scrollHeight: 10, clientWidth: 10, percentage: 40, anchor: null},
  })));
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/public/books/frankenstein-en-b2/chapters')) await route.fulfill({json: []});
    else if (path.endsWith('/public/books/frankenstein-en-b2')) await route.fulfill({json: {...adapted, languageVariants: variants, favorite: false, originalId: original.id, originalLanguage: 'EN'}});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });

  await page.goto('/books/frankenstein-en-b2');
  await expect(page.getByRole('heading', {level: 1})).toHaveText('Frankenstein; or, The Modern Prometheus');

  const edition = page.getByRole('region', {name: 'Edition'});
  await expect(edition.locator('.lang-chip')).toHaveText(['Original · C1', 'Adapted · B2']);
  await expect(edition.locator('.lang-chip--solid')).toHaveText('Adapted · B2');
  await expect(edition.locator('.lang-chip--outline')).toHaveAttribute('href', '/books/frankenstein-en-c1');
  await expect(edition.locator('.lang-chip--outline .lang-chip__hairline')).toHaveCSS('width', /px/);
  await expect(edition.locator('.lang-chip--solid .lang-chip__hairline')).toHaveCount(0);

  // The Parallel text row holds only other languages, named without level or kind, and says what a
  // companion translated from the original follows.
  const parallel = page.getByRole('region', {name: 'Parallel text'});
  await expect(parallel.locator('.lang-chip')).toHaveText(['Ukrainian']);
  await expect(parallel.locator('.parallel__note')).toHaveText('Ukrainian follows the original text, not this adaptation.');
  await page.screenshot({path: testInfo.outputPath('book-editions.png'), animations: 'disabled'});
});
