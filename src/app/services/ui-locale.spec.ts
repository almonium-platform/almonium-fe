import {
  availableUiLocales,
  detectUiLocale,
  readUiLocalePreference,
  resolveUiLocale,
  UI_LOCALE_AUTO,
  UI_LOCALE_PREFERENCES_KEY,
} from './ui-locale';

describe('ui-locale', () => {
  const storageWith = (value: unknown): Pick<Storage, 'getItem'> => ({
    getItem: (key: string) => (key === UI_LOCALE_PREFERENCES_KEY ? JSON.stringify(value) : null),
  });

  it('offers the pseudo-locale only on a dev build', () => {
    expect(availableUiLocales(false).map(locale => locale.code)).toEqual(['en']);
    expect(availableUiLocales(true).map(locale => locale.code)).toEqual(['en', 'pseudo']);
  });

  it('follows the first browser language it has, matching on the language alone', () => {
    expect(detectUiLocale(['de-AT', 'en-GB'])).toBe('en');
    expect(detectUiLocale(['EN-us'])).toBe('en');
    expect(detectUiLocale([])).toBe('en');
  });

  it('never detects the pseudo-locale from the browser', () => {
    expect(detectUiLocale(['pseudo'])).toBe('en');
  });

  it('reads a stored choice and treats anything else as automatic', () => {
    expect(readUiLocalePreference(storageWith({uiLocale: 'en'}), false)).toBe('en');
    expect(readUiLocalePreference(storageWith({appearance: 'dark'}), false)).toBe(UI_LOCALE_AUTO);
    expect(readUiLocalePreference(storageWith({uiLocale: 'xx'}), false)).toBe(UI_LOCALE_AUTO);
    expect(readUiLocalePreference({getItem: () => 'not json'}, false)).toBe(UI_LOCALE_AUTO);
  });

  it('drops a stored pseudo-locale on a production build', () => {
    expect(readUiLocalePreference(storageWith({uiLocale: 'pseudo'}), true)).toBe('pseudo');
    expect(readUiLocalePreference(storageWith({uiLocale: 'pseudo'}), false)).toBe(UI_LOCALE_AUTO);
  });

  it('resolves an explicit choice over the browser, and automatic through the browser', () => {
    expect(resolveUiLocale('pseudo', ['en'], true)).toBe('pseudo');
    expect(resolveUiLocale('pseudo', ['en'], false)).toBe('en');
    expect(resolveUiLocale(UI_LOCALE_AUTO, ['fr', 'en'], false)).toBe('en');
  });
});
