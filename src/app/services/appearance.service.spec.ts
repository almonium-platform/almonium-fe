import {TestBed} from '@angular/core/testing';
import {ThemeService} from 'stream-chat-angular';
import {BehaviorSubject} from 'rxjs';
import {TUI_DARK_MODE} from '@taiga-ui/core/tokens';
import {AppearanceService} from './appearance.service';

describe('AppearanceService', () => {
  let service: AppearanceService;
  let streamTheme: {theme$: BehaviorSubject<string>};
  let darkMode: jasmine.Spy;

  const stored = (): unknown => JSON.parse(window.localStorage.getItem(AppearanceService.PREFERENCES_KEY) ?? 'null');

  beforeEach(() => {
    window.localStorage.removeItem(AppearanceService.PREFERENCES_KEY);
    streamTheme = {theme$: new BehaviorSubject('light')};
    darkMode = jasmine.createSpy('darkMode.set');
    TestBed.configureTestingModule({
      providers: [
        {provide: ThemeService, useValue: streamTheme},
        {provide: TUI_DARK_MODE, useValue: {set: darkMode}},
      ],
    });
    service = TestBed.inject(AppearanceService);
  });

  afterEach(() => {
    window.localStorage.removeItem(AppearanceService.PREFERENCES_KEY);
    delete document.documentElement.dataset['theme'];
    document.documentElement.style.colorScheme = '';
  });

  it('starts on system when nothing is stored', () => {
    expect(service.appearance).toBe('system');
  });

  it('toggle lands on the opposite of what is showing and keeps the rest of the blob', () => {
    window.localStorage.setItem(AppearanceService.PREFERENCES_KEY, JSON.stringify({appearance: 'dark', dailyReview: true}));
    service.apply();

    service.toggle();

    expect(stored()).toEqual({appearance: 'light', dailyReview: true});
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(streamTheme.theme$.value).toBe('light');
    expect(darkMode).toHaveBeenCalledWith(false);
  });

  it('toggle from light goes dark', () => {
    service.set('light');
    service.toggle();

    expect(service.appearance).toBe('dark');
    expect(streamTheme.theme$.value).toBe('dark');
    expect(darkMode).toHaveBeenCalledWith(true);
  });

  it('publishes the choice so the settings control can follow', () => {
    const seen: string[] = [];
    service.appearance$.subscribe(appearance => seen.push(appearance));

    service.set('dark');
    service.set('system');

    expect(seen).toEqual(['system', 'dark', 'system']);
    expect(document.documentElement.style.colorScheme).toBe('light dark');
  });

  it('recognises Ctrl or Cmd with Shift and L, and nothing looser', () => {
    const chord = (init: KeyboardEventInit) => AppearanceService.isToggleShortcut(new KeyboardEvent('keydown', init));

    expect(chord({key: 'L', ctrlKey: true, shiftKey: true})).toBeTrue();
    expect(chord({key: 'l', metaKey: true, shiftKey: true})).toBeTrue();
    expect(chord({key: 'l', ctrlKey: true})).toBeFalse();
    expect(chord({key: 'l', shiftKey: true})).toBeFalse();
    expect(chord({key: 'L', ctrlKey: true, shiftKey: true, altKey: true})).toBeFalse();
  });
});
