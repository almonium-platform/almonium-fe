import {Injectable} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {LocalStorageService} from './local-storage.service';
import {LanguageCode} from '../models/language.enum';
import {map} from "rxjs/operators";
import {UserInfoService} from "./user-info.service";


@Injectable({
  providedIn: 'root'
})
export class TargetLanguageDropdownService {
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

  private langColorsSubject = new BehaviorSubject<{ [key: string]: string }>(
    this.getCachedLangColors() || {}
  );
  langColors$ = this.langColorsSubject.asObservable();

  constructor(
    private localStorageService: LocalStorageService,
    private http: HttpClient,
    private userInfoService: UserInfoService
  ) {
    this.loadLangColors(); // Load colors on app start
  }

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

  // Load the JSON file from assets or cache
  loadLangColors(): void {
    const cachedColors = this.getCachedLangColors();
    if (cachedColors) {
      this.langColorsSubject.next(cachedColors);
    } else {
      this.http.get<{ [key: string]: string }>('assets/lang-color.json').subscribe((colors) => {
        this.langColorsSubject.next(colors);
        this.localStorageService.saveLangColors(colors); // Cache in local storage
      });
    }
  }

  // Get cached language colors from localStorage
  private getCachedLangColors(): { [key: string]: string } | null {
    return this.localStorageService.getLangColors();
  }
}
