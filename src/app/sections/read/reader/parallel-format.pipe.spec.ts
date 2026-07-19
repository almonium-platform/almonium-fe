import {ParallelFormatPipe, ParallelFormatOptions} from './parallel-format.pipe';

describe('ParallelFormatPipe', () => {
  const pipe = new ParallelFormatPipe();

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
    expect(document.querySelector('.fluent-segment-inline > .segment[lang="en"] em')?.textContent).withContext(result).toBe('Chapter');
    expect(document.querySelector('.segment[lang="uk"]')?.textContent).withContext(result).toBe('Розділ');
  });

  it('does not interpolate language codes into CSS selectors', () => {
    const options: ParallelFormatOptions = {
      mode: 'overlay',
      targetLang: 'uk"]:not(span)',
      fluentLang: 'en',
    };
    const html = '<p><span class="seg-pair"><span class="segment" lang="en">Text</span></span></p>';

    expect(() => pipe.transform(html, options)).not.toThrow();
  });
});
