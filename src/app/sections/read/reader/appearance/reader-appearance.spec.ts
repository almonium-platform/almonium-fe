import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {of} from 'rxjs';
import {DEFAULT_UI_PREFERENCES} from '../../../../models/userinfo.model';
import {LocalStorageService} from '../../../../services/local-storage.service';
import {UserInfoService} from '../../../../services/user-info.service';
import {ProfileSettingsService} from '../../../settings/profile/profile-settings.service';
import {DEFAULT_READER_APPEARANCE, parseReaderAppearance} from './reader-appearance';
import {ReaderAppearanceService} from './reader-appearance.service';

describe('parseReaderAppearance', () => {
  it('gives the defaults for nothing at all', () => {
    expect(parseReaderAppearance(undefined)).toEqual(DEFAULT_READER_APPEARANCE);
    expect(parseReaderAppearance('sepia')).toEqual(DEFAULT_READER_APPEARANCE);
  });

  it('keeps each valid field and defaults each invalid one', () => {
    expect(parseReaderAppearance({theme: 'sepia', font: 'comic', size: 6, lineSpacing: 3, width: 1.5})).toEqual({
      theme: 'sepia',
      font: 'serif',
      size: 6,
      lineSpacing: DEFAULT_READER_APPEARANCE.lineSpacing,
      width: DEFAULT_READER_APPEARANCE.width,
    });
  });
});

describe('ReaderAppearanceService', () => {
  let stored: unknown;
  let user: {currentUserInfo: unknown; updateUserInfo: jasmine.Spy};
  let save: jasmine.Spy;

  function create(): ReaderAppearanceService {
    save = jasmine.createSpy('saveUiPreferences').and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        {provide: LocalStorageService, useValue: {getItem: () => stored, saveItem: (_key: string, value: unknown) => { stored = value; }}},
        {provide: UserInfoService, useValue: user},
        {provide: ProfileSettingsService, useValue: {saveUiPreferences: save}},
      ],
    });
    return TestBed.inject(ReaderAppearanceService);
  }

  beforeEach(() => {
    stored = null;
    user = {currentUserInfo: null, updateUserInfo: jasmine.createSpy('updateUserInfo')};
  });

  it('opens with what this device kept, and a guest\'s change stays on the device', fakeAsync(() => {
    stored = {theme: 'night', size: 4};
    const service = create();
    expect(service.appearance().theme).toBe('night');
    expect(service.sizePx()).toBe(23);

    service.change({font: 'atkinson'});
    tick(1000);
    expect((stored as {font: string}).font).toBe('atkinson');
    expect(save).not.toHaveBeenCalled();
  }));

  it('takes a member\'s account choice over the device\'s, and saves a burst of changes once', fakeAsync(() => {
    stored = {theme: 'night'};
    const preferences = structuredClone(DEFAULT_UI_PREFERENCES);
    preferences.reader.appearance.theme = 'sepia';
    user.currentUserInfo = {uiPreferences: preferences};
    const service = create();
    service.adoptAccountChoice();
    expect(service.appearance().theme).toBe('sepia');

    service.stepSize(1);
    service.stepSize(1);
    service.stepSize(1);
    tick(1000);
    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.calls.mostRecent().args[0] as typeof DEFAULT_UI_PREFERENCES;
    expect(saved.reader.appearance).toEqual(jasmine.objectContaining({theme: 'sepia', size: 5}));
    // The stored preferences are not mutated in place: the copy carries the change.
    expect(preferences.reader.appearance.size).toBe(DEFAULT_READER_APPEARANCE.size);
  }));

  it('stops at the ends of the size scale and resets to the defaults', () => {
    const service = create();
    for (let i = 0; i < 10; i++) service.stepSize(1);
    expect(service.sizePx()).toBe(29);
    expect(service.isDefault()).toBeFalse();
    service.reset();
    expect(service.appearance()).toEqual(DEFAULT_READER_APPEARANCE);
    expect(service.isDefault()).toBeTrue();
  });
});
