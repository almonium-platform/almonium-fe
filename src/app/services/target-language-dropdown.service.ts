import { Injectable, inject } from '@angular/core';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {LocalStorageService} from './local-storage.service';
import {LanguageCode} from '../models/language.enum';
import {map} from "rxjs/operators";
import {UserInfoService} from "./user-info.service";
import {LANGUAGE_COLOURS} from "../shared/language-colours";


@Injectable({
  providedIn: 'root'
})
export class TargetLanguageDropdownService {
  private localStorageService = inject(LocalStorageService);
  private userInfoService = inject(UserInfoService);

  private currentLanguageSubject = new BehaviorSubject<LanguageCode>(
    this.localStorageService.getCurrentLanguage()
  );
  currentLanguage$ = this.currentLanguageSubject.asObservable();

  private targetLanguagesSubject = new BehaviorSubject<LanguageCode[]>([]);
  targetLanguages$ = this.targetLanguagesSubject.asObservable();

  filteredLanguages$: Observable<LanguageCode[]> = combineLatest([
    this.targetLanguages$,
    this.currentLanguage$
  ]).pipe(
    map(([targetLanguages, currentLanguage]) =>
      targetLanguages.filter(lang => lang !== currentLanguage)
    )
  );

  private langColorsSubject = new BehaviorSubject<Record<string, string>>(
    this.localStorageService.getLangColors() ?? {}
  );
  langColors$ = this.langColorsSubject.asObservable();

  clearTargetAndCurrentLanguages(): void {
    this.targetLanguagesSubject.next([]);
    this.localStorageService.removeCurrentLanguage();
  }

  // Initialize target languages and set the current language
  initializeLanguages(userInfo: { activeTargetLangs: LanguageCode[] }): void {
    const storedLanguage = this.localStorageService.getCurrentLanguage();
    const targetLanguages = userInfo.activeTargetLangs;

    // Update targetLanguages
    this.targetLanguagesSubject.next(targetLanguages);

    this.ensurePaletteColours(targetLanguages);

    if (storedLanguage && targetLanguages.includes(storedLanguage)) {
      this.setCurrentLanguage(storedLanguage);
    } else if (targetLanguages.length > 0) {
      this.setCurrentLanguage(targetLanguages[0]); // Default to the first language
    }
  }

  // Set and update the current language
  setCurrentLanguage(language: LanguageCode): void {
    this.currentLanguageSubject.next(language);
    this.localStorageService.saveCurrentLanguage(language); // Save in local storage
  }

  removeTargetLanguage(deletedLanguage: LanguageCode): void {
    const targetLanguages = this.targetLanguagesSubject.getValue().filter(lang => lang !== deletedLanguage);

    // Update targetLanguages
    this.targetLanguagesSubject.next(targetLanguages);
    this.userInfoService.updateUserInfo({targetLangs: targetLanguages});

    // Check if the deleted language was the current language
    if (this.currentLanguageSubject.getValue() === deletedLanguage) {
      // Switch to the next available language or the first one
      const nextLanguage = targetLanguages.length > 0 ? targetLanguages[0] : null;
      if (nextLanguage) {
        this.setCurrentLanguage(nextLanguage);
      }
    }
  }

  /**
   * Every crest is drawn from the fixed palette, so a language without a colour - or holding one from
   * outside the palette - is given a free swatch rather than showing whatever was cached.
   */
  ensurePaletteColours(languages: LanguageCode[]): void {
    const palette = new Set<string>(LANGUAGE_COLOURS.map((colour) => colour.hex));
    const colours = {...this.langColorsSubject.getValue()};
    let changed = false;

    languages.forEach((language, index) => {
      if (palette.has(colours[language])) {
        return;
      }
      // Two lists reach this - the active languages and the full learner list - so the swatch is picked by what
      // is free rather than by position, which would hand out a colour a language elsewhere is already wearing.
      const taken = new Set(Object.values(colours));
      const free = LANGUAGE_COLOURS.find((colour) => !taken.has(colour.hex));
      colours[language] = (free ?? LANGUAGE_COLOURS[index % LANGUAGE_COLOURS.length]).hex;
      changed = true;
    });

    if (changed) {
      this.setLanguageColors(colours);
    }
  }

  setLanguageColor(language: LanguageCode, color: string): void {
    const colors = {...this.langColorsSubject.getValue(), [language]: color};
    this.setLanguageColors(colors);
  }

  setLanguageColors(colors: Record<string, string>): void {
    this.langColorsSubject.next(colors);
    this.localStorageService.saveLangColors(colors);
  }
}
