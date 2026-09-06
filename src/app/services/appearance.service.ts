import {inject, Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {TUI_DARK_MODE} from '@taiga-ui/core/tokens';
import {ThemeService} from 'stream-chat-angular';
import {LocalStorageService} from './local-storage.service';
import {applyThemeAssets} from './theme-assets';
import {applyMotionPreference, resolveReducedMotion} from './motion-preference';

export type Appearance = 'light' | 'dark' | 'system';

interface StoredAppPreferences {
  appearance?: Appearance;
  reduceMotion?: boolean;
}

/**
 * Owns the light/dark/system choice: reads it from local storage, paints it onto the document, Taiga, Stream, and
 * the favicon, and flips it on the Ctrl/Cmd+Shift+L shortcut. Settings and the root component share it so a toggle
 * made anywhere shows up in the theme control at once.
 */
@Injectable({providedIn: 'root'})
export class AppearanceService {
  static readonly PREFERENCES_KEY = 'app_preferences';
  /** The toggle chord, in the same spelling as the navbar's language shortcut. */
  static readonly SHORTCUT_LABEL = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? '⌘⇧L'
    : 'Ctrl+Shift+L';

  private localStorageService = inject(LocalStorageService);
  private taigaDarkMode = inject(TUI_DARK_MODE);
  private streamThemeService = inject(ThemeService);
  private systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  private systemMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly appearanceSubject = new BehaviorSubject<Appearance>(this.stored()?.appearance ?? 'system');

  /** The stored choice; 'system' until the user picks a side. */
  readonly appearance$ = this.appearanceSubject.asObservable();

  get appearance(): Appearance {
    return this.appearanceSubject.value;
  }

  /** Whether the page is dark right now, with 'system' resolved against the OS. */
  get isDark(): boolean {
    const appearance = this.appearance;
    return appearance === 'dark' || (appearance !== 'light' && this.systemTheme.matches);
  }

  /** Re-reads local storage and paints it. Call after any write to the preferences blob. */
  apply(): void {
    const preferences = this.stored();
    const appearance = preferences?.appearance ?? 'system';
    const isDark = appearance === 'dark' || (appearance !== 'light' && this.systemTheme.matches);
    const root = document.documentElement;
    root.dataset['theme'] = appearance;
    root.style.colorScheme = appearance === 'system' ? 'light dark' : appearance;
    applyMotionPreference(root, resolveReducedMotion(preferences, this.systemMotion));
    this.taigaDarkMode.set(isDark);
    this.streamThemeService.theme$.next(isDark ? 'dark' : 'light');
    applyThemeAssets(isDark);
    if (appearance !== this.appearanceSubject.value) this.appearanceSubject.next(appearance);
  }

  /** Stores the choice beside whatever else lives in the preferences blob, then paints it. */
  set(appearance: Appearance): void {
    this.localStorageService.saveItem(AppearanceService.PREFERENCES_KEY, {...this.stored(), appearance});
    this.apply();
  }

  /** Flips between the two explicit sides. From 'system' it lands on the opposite of what is showing. */
  toggle(): void {
    this.set(this.isDark ? 'light' : 'dark');
  }

  /** True when the event is the toggle chord: Ctrl or Cmd, Shift, and L. */
  static isToggleShortcut(event: KeyboardEvent): boolean {
    return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'l';
  }

  /** Repaints when the OS theme or motion setting changes while 'system' is chosen. Returns the teardown. */
  followSystem(): () => void {
    const sync = () => this.apply();
    this.systemTheme.addEventListener('change', sync);
    this.systemMotion.addEventListener('change', sync);
    return () => {
      this.systemTheme.removeEventListener('change', sync);
      this.systemMotion.removeEventListener('change', sync);
    };
  }

  private stored(): StoredAppPreferences | null {
    return this.localStorageService.getItem<StoredAppPreferences>(AppearanceService.PREFERENCES_KEY);
  }
}
