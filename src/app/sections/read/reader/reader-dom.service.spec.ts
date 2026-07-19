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
