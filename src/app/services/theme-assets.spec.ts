import {applyThemeAssets} from './theme-assets';

describe('theme assets', () => {
  let favicon: HTMLLinkElement;

  beforeEach(() => {
    favicon = document.createElement('link');
    favicon.id = 'app-favicon';
    document.head.appendChild(favicon);
  });

  afterEach(() => favicon.remove());

  it('uses the plum flat emblem in light mode', () => {
    applyThemeAssets(false);

    expect(favicon.getAttribute('href')).toBe('assets/img/logo/logo-flat.svg');
  });

  it('uses the tint flat emblem in dark mode', () => {
    applyThemeAssets(true);

    expect(favicon.getAttribute('href')).toBe('assets/img/logo/logo-flat-tint.svg');
  });
});
