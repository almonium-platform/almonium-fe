import {ReaderDomService} from './reader-dom.service';

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
      version: 1,
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
      version: 1,
      scrollTop: 731,
      scrollHeight: 2000,
      clientWidth: 800,
      percentage: 48.7,
      anchor: {path: [0], offset: 25},
    })).toBe(325);
  });

  it('opens only the selected overlay translation', () => {
    const content = document.createElement('div');
    content.innerHTML = `
      <span class="seg-pair"><span id="first" class="segment">One</span><span class="fluent-segment-overlay is-visible">Uno</span></span>
      <span class="seg-pair"><span id="second" class="segment">Two</span><span id="translation" class="fluent-segment-overlay">Dos</span></span>
    `;

    service.toggleOverlayTranslation(content, content.querySelector('#second'));

    expect(content.querySelector('#first')?.nextElementSibling?.classList.contains('is-visible')).toBeFalse();
    expect(content.querySelector('#translation')?.classList.contains('is-visible')).toBeTrue();
  });

  it('measures only identified chapter headings', () => {
    const content = document.createElement('div');
    content.innerHTML = '<h2 id="chapter-1"><span class="segment" lang="EN"> First chapter </span></h2><h2>Ignored</h2>';

    expect(service.measureChapters(content, 'EN')).toEqual([{
      title: 'First chapter',
      offsetTop: 0,
      elementId: 'chapter-1',
      index: 0,
    }]);
  });
});
