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

for (const mode of ['side', 'inline', 'demand']) {
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
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('/reader/frankenstein-b2?parallel=frankenstein-original');
  const primaryPane = mode === 'side' ? page.locator('.sbs-cell--primary').last() : page.locator('.reader-content span.segment[data-side="primary"]');
  const companionPane = mode === 'side' ? page.locator('.sbs-cell--companion').last()
    : mode === 'inline' ? page.locator('.reader-content .companion-run') : page.locator('.reader-content .companion-source');
  await expect(primaryPane).toContainText('The rain fell.');
  await expect(companionPane).toContainText(companionText);
  if (mode === 'demand') await expect(companionPane).toBeHidden();
  expect(requestedPair).toBeTruthy();
  // Nothing is painted at rest; the group lights on hover on both sides, and the selection adds the rule.
  await expect(page.locator('.is-lit')).toHaveCount(0);
  await primaryPane.locator('.aligned-sentence').first().hover();
  await expect(page.locator('.is-lit')).toHaveCount(3);
  await primaryPane.locator('.aligned-sentence').first().click();
  await expect(page.locator('.is-aligned-current')).toHaveCount(3);
  if (mode === 'demand') {
    // The block opens right after the group's last sentence, splitting the paragraph there.
    await expect(page.locator('.aligned-sentence:nth-of-type(2) + .companion-block')).toHaveText(companionText);
  }
  if (mode !== 'demand') {
    await (mode === 'inline' ? companionPane.first() : companionPane.locator('[data-alignment]').first()).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.is-aligned-current')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('.is-aligned-current')).toHaveCount(3);
  }
  await page.screenshot({path: testInfo.outputPath(`parallel-${language}-${mode}.png`), fullPage: true, animations: 'disabled'});
  await page.keyboard.press('Escape');
  await expect(page.locator('.is-aligned-current')).toHaveCount(0);
  await expect(page.locator('.companion-block')).toHaveCount(0);
  const pair = page.locator('.chapter-head__pair');
  await expect(pair).toContainText(`EN B2 ↔ ${language} C1`);
  await expect(pair).toContainText(language === 'EN' ? 'English, original' : 'Ukrainian, translation of the original');
  await expect(pair.locator('.chapter-head__mode')).toHaveText({side: 'Side by side', inline: 'Inline', demand: 'On demand'}[mode]!);
  await expect(page.locator('.chapter-head__place')).toContainText('Chapter 1 of 1 · Estimated B2');
  await expect(page.locator('.chapter-head__description')).toContainText('A scientist faces an unexpected result.');
  if (language === 'UK') {
    // The bar's companion button opens the picker (L5); Change leads on to the companion menu.
    await page.locator('app-parallel-translation').click();
    const picker = page.getByRole('group', {name: 'Companion and reading mode'});
    await expect(picker.getByRole('radio', {checked: true})).toHaveText(new RegExp({side: 'Side by side', inline: 'Inline', demand: 'On demand'}[mode]!));
    await expect(picker).toContainText('Companion: Ukrainian C1, translation of the original');
    await page.screenshot({path: testInfo.outputPath(`picker-${mode}.png`), fullPage: true, animations: 'disabled'});
    await picker.getByRole('button', {name: 'Change'}).click();
    const toggle = page.getByRole('switch', {name: 'Include translations of other editions:'});
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({path: testInfo.outputPath(`companion-switch-${mode}-on.png`), fullPage: true, animations: 'disabled'});
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.chapter-head__pair')).toHaveCount(0);
    await page.screenshot({path: testInfo.outputPath(`companion-switch-${mode}-off.png`), fullPage: true, animations: 'disabled'});
  }
});
}
}

test('underlines the sentence pairs in Side by side only once asked, from a switch under that row', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('parallel_mode', JSON.stringify('side')));
  const primary = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'frankenstein-b2', language: 'EN', editionType: 'adaptation', cefrLevel: 'B2'};
  const companion = {id: '01989f47-4c2a-7a10-9e5b-751983624a26', editionSlug: 'frankenstein-uk', language: 'UK', editionType: 'machine_translation', cefrLevel: 'C1', sourceEditionSlug: 'frankenstein-b2'};
  const metadata = {...primary, workSlug: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', description: '', publicationYear: 1818, coverUrl: null, wordCount: 76000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: true, languageVariants: [primary, companion]};
  const sentence = (key: string, text: string): string => `<span class="aligned-sentence" role="button" tabindex="0" data-alignment="${key}">${text}</span>`;
  const pairHtml = '<section class="chapter"><h2 id="chapter-11" class="chapter-title">Chapter X</h2><p><span class="seg-pair"><span class="segment" data-side="primary" lang="en">'
    + sentence('11-2-0', 'I spent the following day roaming through the valley.') + ' '
    + sentence('11-2-1', 'I stood beside the sources of the Arveiron, which take their rise in a glacier, that with slow pace is advancing down from the summit of the hills, to barricade the valley.') + ' '
    + sentence('11-2-2', 'The abrupt sides of vast mountains were before me; the icy wall of the glacier overhung me; a few shattered pines were scattered around;') + ' '
    + sentence('11-2-3', 'and the solemn silence of this glorious presence-chamber of imperial Nature was broken only by the brawling waves, or the fall of some vast fragment, the thunder sound of the avalanche.') + ' '
    + sentence('11-2-4', 'These sublime and magnificent scenes afforded me the greatest consolation that I was capable of receiving.')
    + '</span><span class="segment" data-side="secondary" lang="uk">'
    + sentence('11-2-0', 'Наступний день я провів, блукаючи долиною.') + ' '
    + sentence('11-2-1', 'Я стояв біля витоків Арвейрону, що беруть початок у льодовику, який повільно спускається з вершини пагорбів, аби загатити долину.') + ' '
    + sentence('11-2-2', 'Переді мною височіли стрімкі схили величезних гір; наді мною нависала крижана стіна льодовика; довкола були розкидані кілька потрощених сосон;') + ' '
    + sentence('11-2-3', 'і врочисту тишу цієї славної тронної зали величної Природи порушували лише шумливі хвилі, або падіння якогось велетенського уламка, громоподібний звук лавини.') + ' '
    + sentence('11-2-4', 'Ці піднесені й величні краєвиди давали мені найбільшу втіху, яку я тільки міг прийняти.')
    + '</span></span></p><p><span class="seg-pair"><span class="segment" data-side="primary" lang="en">A paragraph aligned as a whole.</span><span class="segment" data-side="secondary" lang="uk">Абзац, вирівняний цілком.</span></span></p></section>';
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/parallel-edition/frankenstein-uk')) await route.fulfill({contentType: 'text/html', body: pairHtml});
    else if (path.endsWith('/frankenstein-b2/chapters')) await route.fulfill({json: []});
    else if (path.endsWith('/frankenstein-b2/text')) await route.fulfill({contentType: 'text/html', body: '<section class="chapter"><h2 class="chapter-title" id="chapter-11">X</h2><p>Base text</p></section>'});
    else if (path.endsWith('/frankenstein-b2')) await route.fulfill({json: metadata});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto('/reader/frankenstein-b2?parallel=frankenstein-uk');
  const content = page.locator('.reader-content');
  await expect(content).toHaveClass(/mode-side/);
  // Off by default: the inks are in the DOM, nothing is painted.
  await expect(content).not.toHaveClass(/show-pairs/);
  await expect(content.locator('[data-ink]')).toHaveCount(10);
  const underline = content.locator('.sbs-cell--companion [data-alignment="11-2-1"]');
  expect(await underline.evaluate(node => getComputedStyle(node).textDecorationLine)).toBe('none');

  await page.locator('app-parallel-translation').click();
  const picker = page.getByRole('group', {name: 'Companion and reading mode'});
  const pairs = picker.getByRole('switch', {name: 'Show sentence pairs'});
  await expect(pairs).toHaveAttribute('aria-checked', 'false');
  await pairs.click();
  await expect(pairs).toHaveAttribute('aria-checked', 'true');
  await expect(content).toHaveClass(/show-pairs/);
  expect(await underline.evaluate(node => getComputedStyle(node).textDecorationLine)).toBe('underline');
  // Both halves of a pair share an ink; the paragraph-only pair has none.
  const inkOf = (side: string, key: string): Promise<string | null> => content.locator(`.sbs-cell--${side} [data-alignment="${key}"]`).getAttribute('data-ink');
  expect(await inkOf('primary', '11-2-3')).toBe('0');
  expect(await inkOf('companion', '11-2-3')).toBe('0');
  expect(await inkOf('primary', '11-2-4')).toBe('1');
  await expect(content.locator('[data-pair="1"][data-ink]')).toHaveCount(0);
  // Hover paints on top of the underline.
  await content.locator('.sbs-cell--primary [data-alignment="11-2-3"]').hover();
  await expect(content.locator('.is-lit')).toHaveCount(2);
  await page.screenshot({path: testInfo.outputPath('side-pairs-on.png'), fullPage: true, animations: 'disabled'});

  // The switch belongs to the Side by side row: picking another row folds it away.
  await picker.getByRole('radio', {name: /On demand/}).click();
  await expect(content).toHaveClass(/mode-demand/);
  await expect(pairs).toBeHidden();
  await page.screenshot({path: testInfo.outputPath('picker-pairs-folded.png'), fullPage: true, animations: 'disabled'});
  await picker.getByRole('radio', {name: /Side by side/}).click();
  await expect(pairs).toBeVisible();
  await expect(pairs).toHaveAttribute('aria-checked', 'true');
  await expect(content).toHaveClass(/show-pairs/);
});

test('falls back to On demand below 1100px and offers the merged sheet on a phone', async ({page}, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('parallel_mode', JSON.stringify('side')));
  const primary = {id: '01989f47-4c2a-7a10-9e5b-751983624a25', editionSlug: 'frankenstein-b2', language: 'EN', editionType: 'adaptation', cefrLevel: 'B2'};
  const companion = {id: '01989f47-4c2a-7a10-9e5b-751983624a26', editionSlug: 'frankenstein-uk', language: 'UK', editionType: 'machine_translation', cefrLevel: 'C1', sourceEditionSlug: 'frankenstein-b2'};
  const metadata = {...primary, workSlug: 'frankenstein', title: 'Frankenstein', author: 'Mary Shelley', description: '', publicationYear: 1818, coverUrl: null, wordCount: 76000, progressPercentage: null, isTranslation: false, hasTranslation: false, hasParallelTranslation: true, languageVariants: [primary, companion]};
  const pairHtml = '<section class="chapter"><h2 id="chapter-11" class="chapter-title">Chapter V</h2><p><span class="seg-pair"><span class="segment" data-side="primary" lang="en"><span class="aligned-sentence" role="button" tabindex="0" data-alignment="11-2-0">The rain fell.</span></span><span class="segment" data-side="secondary" lang="uk"><span class="aligned-sentence" role="button" tabindex="0" data-alignment="11-2-0">Дощ падав.</span></span></span></p></section>';
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/parallel-edition/frankenstein-uk')) await route.fulfill({contentType: 'text/html', body: pairHtml});
    else if (path.endsWith('/frankenstein-b2/chapters')) await route.fulfill({json: []});
    else if (path.endsWith('/frankenstein-b2/text')) await route.fulfill({contentType: 'text/html', body: '<section class="chapter"><h2 class="chapter-title" id="chapter-11">V</h2><p>Base text</p></section>'});
    else if (path.endsWith('/frankenstein-b2')) await route.fulfill({json: metadata});
    else await route.fulfill({status: 401, json: {message: 'Anonymous preview'}});
  });
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/reader/frankenstein-b2?parallel=frankenstein-uk');
  await expect(page.locator('.reader-content')).toHaveClass(/mode-demand/);
  await expect(page.locator('.chapter-head__mode')).toHaveText('On demand');
  await expect(page.locator('.chapter-head__words')).toBeHidden();
  await page.locator('.aligned-sentence').first().click();
  await expect(page.locator('.companion-block')).toHaveText('Дощ падав.');
  await page.screenshot({path: testInfo.outputPath('phone-demand-open.png'), fullPage: true, animations: 'disabled'});
  await page.locator('app-parallel-translation').click();
  const sheet = page.getByRole('group', {name: 'Companion and reading mode'});
  await expect(sheet.getByRole('radio')).toHaveCount(2);
  await expect(sheet.getByRole('switch', {name: 'Show sentence pairs'})).toHaveCount(0);
  await expect(sheet.getByRole('radio', {checked: true})).toHaveText(/On demand/);
  await expect(sheet.getByRole('button', {name: /Ukrainian · C1/})).toHaveAttribute('aria-pressed', 'true');
  await expect(sheet.getByRole('button', {name: 'Read without a companion'})).toBeVisible();
  await page.screenshot({path: testInfo.outputPath('phone-sheet.png'), fullPage: true, animations: 'disabled'});
  await sheet.getByRole('radio', {name: /Inline/}).click();
  await expect(page.locator('.reader-content')).toHaveClass(/mode-inline/);
  await expect(page.locator('.companion-run')).toHaveText('Дощ падав.');
  await sheet.getByRole('button', {name: 'Read without a companion'}).click();
  await expect(page.locator('.chapter-head__pair')).toHaveCount(0);
  await expect(page.locator('.reader-content')).toContainText('Base text');
});
