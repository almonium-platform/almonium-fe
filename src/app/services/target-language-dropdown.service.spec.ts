import {TestBed} from '@angular/core/testing';
import {TargetLanguageDropdownService} from './target-language-dropdown.service';
import {UserInfoService} from './user-info.service';
import {LanguageCode} from '../models/language.enum';
import {LANGUAGE_COLOURS} from '../shared/language-colours';

describe('TargetLanguageDropdownService', () => {
  function serviceWithStoredColours(colours: Record<string, string> | null): TargetLanguageDropdownService {
    localStorage.clear();
    if (colours) {
      localStorage.setItem('langColors', JSON.stringify(colours));
    }
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{provide: UserInfoService, useValue: {}}],
    });
    return TestBed.inject(TargetLanguageDropdownService);
  }

  it('gives a language with no colour its position in the palette', () => {
    const service = serviceWithStoredColours(null);

    service.initializeLanguages({activeTargetLangs: [LanguageCode.EN, LanguageCode.DE]});

    let colours: Record<string, string> = {};
    service.langColors$.subscribe((value) => colours = value);
    expect(colours[LanguageCode.EN]).toBe(LANGUAGE_COLOURS[0].hex);
    expect(colours[LanguageCode.DE]).toBe(LANGUAGE_COLOURS[1].hex);
    expect(JSON.parse(localStorage.getItem('langColors')!)).toEqual(colours);
  });

  it('takes a free swatch, so a second pass over a longer list repeats no colour', () => {
    const service = serviceWithStoredColours(null);

    service.initializeLanguages({activeTargetLangs: [LanguageCode.EN, LanguageCode.DE]});
    service.ensurePaletteColours([LanguageCode.FR, LanguageCode.EN, LanguageCode.DE]);

    let colours: Record<string, string> = {};
    service.langColors$.subscribe((value) => colours = value);
    expect(new Set(Object.values(colours)).size).toBe(3);
    expect(colours[LanguageCode.FR]).toBe(LANGUAGE_COLOURS[2].hex);
  });

  it('redraws a cached colour from outside the palette, and leaves a chosen one alone', () => {
    const service = serviceWithStoredColours({
      [LanguageCode.EN]: '#a11d1d',
      [LanguageCode.DE]: LANGUAGE_COLOURS[5].hex,
    });

    service.initializeLanguages({activeTargetLangs: [LanguageCode.EN, LanguageCode.DE]});

    let colours: Record<string, string> = {};
    service.langColors$.subscribe((value) => colours = value);
    expect(colours[LanguageCode.EN]).toBe(LANGUAGE_COLOURS[0].hex);
    expect(colours[LanguageCode.DE]).toBe(LANGUAGE_COLOURS[5].hex);
  });
});
