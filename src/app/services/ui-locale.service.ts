import {inject, Injectable, isDevMode} from '@angular/core';
import {LocalStorageService} from './local-storage.service';
import {
  availableUiLocales,
  currentUiLocale,
  readUiLocalePreference,
  resolveUiLocale,
  UI_LOCALE_PREFERENCES_KEY,
  uiLocaleByCode,
  UiLocale,
  UiLocalePreference,
  detectUiLocale,
} from './ui-locale';

/**
 * The interface-language setting: what the page runs in, what the browser would pick, and the choice stored
 * beside appearance. Translations are loaded once, before the app starts, so a new choice reloads the page.
 */
@Injectable({providedIn: 'root'})
export class UiLocaleService {
  private localStorageService = inject(LocalStorageService);
  private readonly devMode = isDevMode();

  /** The locale this page is running in. */
  readonly current: UiLocale = currentUiLocale();
  /** What "automatic" resolves to on this browser. */
  readonly detected: UiLocale = uiLocaleByCode(detectUiLocale(navigator.languages));
  /** Everything the select offers; the pseudo-locale only on a dev build. */
  readonly options: readonly UiLocale[] = availableUiLocales(this.devMode);

  get preference(): UiLocalePreference {
    return readUiLocalePreference(window.localStorage, this.devMode);
  }

  /** Stores the choice and, when it changes the language the page shows, reloads to apply it. */
  set(preference: UiLocalePreference): void {
    const stored = this.localStorageService.getItem<Record<string, unknown>>(UI_LOCALE_PREFERENCES_KEY) ?? {};
    this.localStorageService.saveItem(UI_LOCALE_PREFERENCES_KEY, {...stored, uiLocale: preference});
    if (resolveUiLocale(preference, navigator.languages, this.devMode) !== this.current.code) {
      window.location.reload();
    }
  }
}
