import {loadTranslations} from '@angular/localize';

/**
 * The languages the interface itself can speak: which exist, which one the browser asks for, and which one this
 * page is running in.
 *
 * This module stays free of Angular and of `$localize` on purpose. `main.ts` reads it before the app is
 * imported, because every `$localize` call in a module-level constant evaluates on import, and by then the
 * translations have to be loaded already.
 */

/** The stored value that means "follow the browser". */
export const UI_LOCALE_AUTO = 'auto';

export interface UiLocale {
  /** The tag the preference and the translation file are keyed by. */
  readonly code: string;
  /** The name in that language, so a reader finds their own without reading ours. Never translated. */
  readonly nativeName: string;
  /** Angular's locale for dates and numbers. The pseudo-locale formats as English. */
  readonly angularLocale: string;
  /** The translation file under `assets/`; absent for the source language, which needs none. */
  readonly translations?: string;
  /** Offered only on a dev build. */
  readonly devOnly?: boolean;
}

/**
 * Adding a language: one line here, its file under `assets/i18n/`, and its Angular locale data registered in
 * {@link applyUiLocale}. The README ("Interface languages") walks through it.
 */
export const UI_LOCALES = [
  {code: 'en', nativeName: 'English', angularLocale: 'en-US'},
  {
    code: 'pseudo',
    nativeName: 'Pseudo (stretched English)',
    angularLocale: 'en-US',
    translations: 'assets/i18n/pseudo.json',
    devOnly: true,
  },
] as const satisfies readonly UiLocale[];

export type UiLocaleCode = (typeof UI_LOCALES)[number]['code'];
export type UiLocalePreference = typeof UI_LOCALE_AUTO | UiLocaleCode;

export const DEFAULT_UI_LOCALE: UiLocaleCode = 'en';

/** The local-storage blob shared with appearance and the other device-level settings. */
export const UI_LOCALE_PREFERENCES_KEY = 'app_preferences';

export function availableUiLocales(devMode: boolean): readonly UiLocale[] {
  return (UI_LOCALES as readonly UiLocale[]).filter(locale => devMode || !locale.devOnly);
}

export function isUiLocaleCode(value: unknown, devMode: boolean): value is UiLocaleCode {
  return availableUiLocales(devMode).some(locale => locale.code === value);
}

export function uiLocaleByCode(code: string | undefined): UiLocale {
  return (UI_LOCALES as readonly UiLocale[]).find(locale => locale.code === code) ?? UI_LOCALES[0];
}

/** The stored preference, or "auto" when nothing valid is stored. */
export function readUiLocalePreference(storage: Pick<Storage, 'getItem'>, devMode: boolean): UiLocalePreference {
  try {
    const stored: unknown = JSON.parse(storage.getItem(UI_LOCALE_PREFERENCES_KEY) ?? 'null');
    const preference = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>)['uiLocale'] : undefined;
    return isUiLocaleCode(preference, devMode) ? preference : UI_LOCALE_AUTO;
  } catch {
    return UI_LOCALE_AUTO;
  }
}

/**
 * The first browser language we have, matched on the whole tag first (`pt-BR`) and then on the language alone
 * (`pt`), so `de-AT` still lands on German. The pseudo-locale is never a match: nobody's browser asks for it.
 */
export function detectUiLocale(languages: readonly string[]): UiLocaleCode {
  // Narrowed at the return: every shipped code is a member of the table.
  const shipped = (UI_LOCALES as readonly UiLocale[]).filter(locale => !locale.devOnly);
  for (const language of languages) {
    const tag = language.toLowerCase();
    const primary = tag.split('-')[0];
    const match = shipped.find(locale => locale.code.toLowerCase() === tag)
      ?? shipped.find(locale => locale.code.toLowerCase().split('-')[0] === primary);
    if (match) return match.code as UiLocaleCode;
  }
  return DEFAULT_UI_LOCALE;
}

export function resolveUiLocale(
  preference: UiLocalePreference,
  languages: readonly string[],
  devMode: boolean,
): UiLocaleCode {
  return preference !== UI_LOCALE_AUTO && isUiLocaleCode(preference, devMode) ? preference : detectUiLocale(languages);
}

/** The locale this page is running in, once {@link applyUiLocale} has run. */
export function currentUiLocale(): UiLocale {
  return uiLocaleByCode(typeof $localize === 'function' ? $localize.locale : undefined);
}

/**
 * Loads the translations for the locale and tells `$localize` and the document about it. Runs before the app
 * is imported; a missing or broken file logs and leaves the page in English rather than blocking the app.
 */
export async function applyUiLocale(code: UiLocaleCode, warn: (message: string, error: unknown) => void): Promise<void> {
  const locale = uiLocaleByCode(code);
  let applied: UiLocale = locale;
  if (locale.translations) {
    try {
      const response = await fetch(locale.translations);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const file = (await response.json()) as {translations?: Record<string, string>};
      loadTranslations(file.translations ?? {});
    } catch (error) {
      warn(`Could not load the "${locale.code}" translations; the interface stays in English.`, error);
      applied = uiLocaleByCode(DEFAULT_UI_LOCALE);
    }
  }
  $localize.locale = applied.code;
  document.documentElement.lang = applied.angularLocale.split('-')[0];
}
