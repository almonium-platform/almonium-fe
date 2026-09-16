import {ReaderDomService} from './reader-dom.service';
import {sanitizeBookHtml} from './book-html-sanitizer';

describe('ReaderDomService', () => {
  const service = new ReaderDomService();

  it('calculates bounded reader progress and edge state', () => {
    const element = document.createElement('div');
    Object.defineProperties(element, {
      scrollTop: {value: 450, configurable: true},
      scrollHeight: {value: 1000, configurable: true},
      clientHeight: {value: 100, configurable: true},
    });

    expect(service.getScrollState(element)).toEqual({
      percentage: 50,
      isAtTop: false,
      isAtBottom: false,
    });
    expect(service.scrollTopForPercentage(element, 25)).toBe(225);
    expect(service.clampScrollTop(element, 2000)).toBe(900);
  });

  it('treats non-scrollable content as both the top and bottom', () => {
    const element = document.createElement('div');
    Object.defineProperties(element, {
      scrollTop: {value: 0, configurable: true},
      scrollHeight: {value: 100, configurable: true},
      clientHeight: {value: 100, configurable: true},
    });

    expect(service.getScrollState(element)).toEqual({
      percentage: 0,
      isAtTop: true,
      isAtBottom: true,
    });
    expect(service.scrollTopForPercentage(element, 50)).toBeNull();
  });

  it('restores the exact pixel when the reader layout is unchanged', () => {
    const wrapper = document.createElement('div');
    const content = document.createElement('div');
    Object.defineProperties(wrapper, {
      scrollTop: {value: 0, writable: true, configurable: true},
      scrollHeight: {value: 2000, configurable: true},
      clientHeight: {value: 500, configurable: true},
      clientWidth: {value: 800, configurable: true},
    });

    expect(service.scrollTopForPosition(wrapper, content, {
      scrollTop: 731,
      scrollHeight: 2000,
      clientWidth: 800,
      percentage: 48.7,
      anchor: null,
    })).toBe(731);
  });

  it('restores an anchor and pixel offset after the layout changes', () => {
    const wrapper = document.createElement('div');
    const content = document.createElement('div');
    const paragraph = document.createElement('p');
    content.appendChild(paragraph);
    Object.defineProperties(wrapper, {
      scrollTop: {value: 0, writable: true, configurable: true},
      scrollHeight: {value: 3000, configurable: true},
      clientHeight: {value: 500, configurable: true},
      clientWidth: {value: 600, configurable: true},
    });
    wrapper.getBoundingClientRect = () => ({top: 100} as DOMRect);
    paragraph.getBoundingClientRect = () => ({top: 400} as DOMRect);

    expect(service.scrollTopForPosition(wrapper, content, {
      scrollTop: 731,
      scrollHeight: 2000,
      clientWidth: 800,
      percentage: 48.7,
      anchor: {path: [0], offset: 25},
    })).toBe(325);
  });

  it('answers for a sentence group on both sides, or a whole paragraph pair where none exists', () => {
    const content = document.createElement('div');
    content.innerHTML = `
      <p><span class="segment" data-pair="0"><span data-alignment="1-1-0">One.</span> Plain.</span><span class="companion-source" data-pair="0"><span class="segment"><span data-alignment="1-1-0">Uno.</span></span></span></p>
      <p><span class="segment" data-pair="1">Whole.</span><span class="companion-source" data-pair="1"><span class="segment">Entero.</span></span></p>
    `;
    const group = content.querySelector('[data-alignment]')!;
    expect(service.unitAt(content, group).map(element => element.textContent)).toEqual(['One.', 'Uno.']);
    expect(service.unitAt(content, group.nextSibling as unknown as EventTarget)).toEqual([]);
    expect(service.unitAt(content, content.querySelector('[data-pair="1"]')).map(element => element.textContent)).toEqual(['Whole.']);
    expect(service.unitAt(content, document.body)).toEqual([]);
  });

  it('marks one unit and opens only its companion sentences under the paragraph', () => {
    const content = document.createElement('div');
    content.innerHTML = `
      <p id="first"><span class="segment" data-pair="0"><span data-alignment="1-1-0">One.</span> <span data-alignment="1-1-1">Two.</span></span><span class="companion-source"><span class="segment" lang="es"><span data-alignment="1-1-0">Uno.</span> <span data-alignment="1-1-1">Dos.</span></span></span></p>
    `;
    const first = service.unitAt(content, content.querySelector('[data-alignment="1-1-0"]'));
    service.mark(content, first, 'is-lit');
    expect(content.querySelectorAll('.is-lit').length).toBe(2);
    service.mark(content, service.unitAt(content, content.querySelector('[data-alignment="1-1-1"]')), 'is-lit');
    expect(Array.from(content.querySelectorAll('.is-lit')).map(element => element.textContent)).toEqual(['Two.', 'Dos.']);

    expect(service.openCompanionFor(content, first, false)).toBeTrue();
    const block = content.querySelector('#first + .companion-block');
    expect(block?.textContent).toBe('Uno.');
    expect(block?.querySelector('p')?.lang).toBe('es');
    expect(block?.classList.contains('is-open')).toBeTrue();
    service.openCompanionFor(content, service.unitAt(content, content.querySelector('[data-alignment="1-1-1"]')), false);
    expect(content.querySelectorAll('.companion-block').length).toBe(1);
    expect(content.querySelector('.companion-block')?.textContent).toBe('Dos.');
    service.closeCompanionBlock(content);
    expect(content.querySelector('.companion-block')).toBeNull();
  });

  it('measures only identified chapter headings', () => {
    const content = document.createElement('div');
    content.innerHTML = '<section class="chapter"><h2 class="chapter-title" id="chapter-1"><span class="segment" lang="EN"> First chapter </span></h2><h2>Ignored</h2></section>';

    expect(service.measureChapters(content, 'EN')).toEqual([{
      title: 'First chapter',
      offsetTop: 0,
      elementId: 'chapter-1',
      index: 0,
    }]);
    expect(service.findChapter(content, 'chapter-1')).toBe(content.querySelector<HTMLElement>('#chapter-1'));
  });

  it('preserves and discovers the published-book chapter contract', () => {
    const content = document.createElement('div');
    content.innerHTML = sanitizeBookHtml(`
      <section class="chapter"><h2 class="chapter-title" id="chapter-0">Opening</h2><p>Text</p></section>
      <section class="chapter"><h2 class="chapter-title" id="chapter-1">The road</h2><p>More text</p></section>
    `);

    expect(service.measureChapters(content, 'EN').map(chapter => ({title: chapter.title, elementId: chapter.elementId}))).toEqual([
      {title: 'Opening', elementId: 'chapter-0'},
      {title: 'The road', elementId: 'chapter-1'},
    ]);
    expect(content.querySelectorAll('section.chapter > h2.chapter-title[id]').length).toBe(2);
  });
});
