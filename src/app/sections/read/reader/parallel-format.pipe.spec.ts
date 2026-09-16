import {ParallelFormatPipe, ParallelFormatOptions} from './parallel-format.pipe';

describe('ParallelFormatPipe', () => {
  const pipe = new ParallelFormatPipe();

  it('keeps one primary chapter anchor in side-by-side mode', () => {
    const result = new DOMParser().parseFromString(pipe.transform('<h2 id="chapter-10">IV</h2>', {mode: 'side', targetLang: 'en', fluentLang: 'en'}), 'text/html');
    expect(result.querySelectorAll('#chapter-10').length).toBe(1);
    expect(result.querySelector('#chapter-10')?.classList.contains('sbs-span')).toBeTrue();
  });

  it('keeps two English editions distinct and preserves sentence group identifiers', () => {
    const html = '<p><span class="seg-pair"><span class="segment" data-side="primary" lang="en"><span data-alignment="11-2-0">Simple.</span></span><span class="segment" data-side="secondary" lang="en"><span data-alignment="11-2-0">Original wording.</span></span></span></p>';
    for (const mode of ['side', 'inline', 'demand'] as const) {
      const result = new DOMParser().parseFromString(pipe.transform(html, {mode, targetLang: 'en', fluentLang: 'en'}), 'text/html');
      expect(result.querySelectorAll('[data-alignment="11-2-0"]').length).withContext(mode).toBe(2);
      expect(result.body.textContent).withContext(mode).toBe(mode === 'inline' ? 'Simple. Original wording.' : 'Simple.Original wording.');
      if (mode === 'side') {
        expect(result.querySelector('.sbs-cell--primary')?.textContent).toBe('Simple.');
        expect(result.querySelector('.sbs-cell--companion')?.textContent).toBe('Original wording.');
      }
    }
  });

  it('removes executable markup and unsafe attributes from book HTML', () => {
    const maliciousHtml = `
      <h2 id="chapter-1" onclick="alert(1)">Chapter</h2>
      <script>alert(1)</script>
      <svg><script>alert(2)</script></svg>
      <math><mi xlink:href="data:x,<script>alert(3)</script>">X</mi></math>
      <a href="javascript:alert(4)" style="background:url(javascript:alert(5))">bad link</a>
      <img src="data:text/html,<script>alert(6)</script>" onerror="alert(7)" alt="cover">
    `;

    const result = pipe.transform(maliciousHtml, null);
    const document = new DOMParser().parseFromString(result, 'text/html');

    expect(document.querySelector('script, svg, math')).toBeNull();
    expect(document.querySelector('[onclick], [onerror], [style]')).toBeNull();
    expect(document.querySelector('a')?.hasAttribute('href')).toBeFalse();
    expect(document.querySelector('img')?.hasAttribute('src')).toBeFalse();
    expect(document.querySelector('h2')?.id).toBe('chapter-1');
  });

  it('preserves reader structure while formatting parallel text', () => {
    const options: ParallelFormatOptions = {mode: 'inline', targetLang: 'uk', fluentLang: 'en'};
    const html = `
      <div class="chapter">
        <h2 id="chapter-1"><span class="seg-pair"><span class="segment" lang="uk">Розділ</span><span class="segment" lang="en"><em>Chapter</em></span></span></h2>
      </div>
    `;

    const result = pipe.transform(html, options);
    const document = new DOMParser().parseFromString(result, 'text/html');

    expect(document.querySelector('.chapter > #chapter-1')).withContext(result).not.toBeNull();
    expect(document.querySelector('#chapter-1 .companion-run[lang="en"] em')?.textContent).withContext(result).toBe('Chapter');
    expect(document.querySelector('.segment[lang="uk"]')?.textContent).withContext(result).toBe('Розділ');
  });

  it('does not interpolate language codes into CSS selectors', () => {
    const options: ParallelFormatOptions = {
      mode: 'demand',
      targetLang: 'uk"]:not(span)',
      fluentLang: 'en',
    };
    const html = '<p><span class="seg-pair"><span class="segment" lang="en">Text</span></span></p>';

    expect(() => pipe.transform(html, options)).not.toThrow();
  });

  it('assigns one shared and globally unique id to each side-by-side pair', () => {
    const options: ParallelFormatOptions = {mode: 'side', targetLang: 'uk', fluentLang: 'en'};
    const pair = (uk: string, en: string) => `<span class="seg-pair"><span class="segment" lang="uk">${uk}</span><span class="segment" lang="en">${en}</span></span>`;
    const result = pipe.transform(`<p>${pair('Один', 'One')}</p><p>${pair('Два', 'Two')}</p>`, options);
    const document = new DOMParser().parseFromString(result, 'text/html');
    const ids = Array.from(document.querySelectorAll<HTMLElement>('.sbs-segment')).map(segment => segment.dataset['pair']);

    expect(ids).toEqual(['0', '0', '1', '1']);
    expect(document.querySelector('.sbs-grid')).not.toBeNull();
    expect(Array.from(document.querySelectorAll('.sbs-grid > p')).map(cell => cell.className)).toEqual([
      'sbs-cell sbs-cell--primary', 'sbs-cell sbs-cell--companion', 'sbs-cell sbs-cell--primary', 'sbs-cell sbs-cell--companion',
    ]);
  });

  const sentence = (key: string, text: string) => `<span class="aligned-sentence" role="button" tabindex="0" data-alignment="${key}">${text}</span>`;
  const groupedHtml = '<section class="chapter"><p><span class="seg-pair">'
    + `<span class="segment" data-side="primary" lang="en">Lead. ${sentence('1-1-0', 'One.')} ${sentence('1-1-0', 'Two.')} Plain. ${sentence('1-1-1', 'Three.')}</span>`
    + `<span class="segment" data-side="secondary" lang="uk">Вступ. ${sentence('1-1-0', 'Раз-два.')} Просто. ${sentence('1-1-1', 'Три.')} Кінець.</span>`
    + '</span></p><p><span class="seg-pair"><span class="segment" data-side="primary" lang="en">Alone.</span><span class="segment" data-side="secondary" lang="uk">Сам.</span></span></p></section>';

  it('interleaves each sentence group with its companion run, and follows a groupless paragraph with its companion', () => {
    const document = new DOMParser().parseFromString(pipe.transform(groupedHtml, {mode: 'inline', targetLang: 'en', fluentLang: 'uk'}), 'text/html');
    const first = document.querySelector('p')!;
    expect(first.textContent?.replace(/\s+/g, ' ')).toBe('Lead. Вступ. One. Two. Раз-два. Просто. Plain. Three. Три. Кінець.');
    const runs = Array.from(first.querySelectorAll('.companion-run'));
    expect(runs.map(run => run.getAttribute('data-alignment'))).toEqual([null, '1-1-0', '1-1-1']);
    expect(runs.every(run => run.getAttribute('lang') === 'uk')).toBeTrue();
    expect(first.querySelectorAll('.companion-run .aligned-sentence').length).toBe(0);
    expect(first.querySelector('.segment[data-side="secondary"]')).toBeNull();
    const companion = document.querySelector('p + p.companion-paragraph');
    expect(companion?.textContent).toBe('Сам.');
    expect(companion?.getAttribute('data-pair')).toBe(document.querySelector('.segment[data-side="primary"][data-pair]')?.getAttribute('data-pair') ?? 'missing');
  });

  it('keeps the companion in the document, hidden, for on-demand lookup', () => {
    const document = new DOMParser().parseFromString(pipe.transform(groupedHtml, {mode: 'demand', targetLang: 'en', fluentLang: 'uk'}), 'text/html');
    expect(document.querySelectorAll('.companion-source .segment[data-side="secondary"]').length).toBe(2);
    expect(document.querySelectorAll('.companion-source [data-alignment]').length).toBe(2);
    const alone = document.querySelectorAll('.segment[data-side="primary"]')[1];
    expect(alone.getAttribute('role')).toBe('button');
    expect(alone.getAttribute('data-pair')).toBe('1');
  });
});
