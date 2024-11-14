import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {LocalStorageService} from './local-storage.service';
import {Language} from '../models/language.enum';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private currentLanguageSubject = new BehaviorSubject<Language>(this.localStorageService.getCurrentLanguage());
  currentLanguage$ = this.currentLanguageSubject.asObservable();

  private langColorsSubject = new BehaviorSubject<{ [key: string]: string }>(this.getCachedLangColors() || {});
  langColors$ = this.langColorsSubject.asObservable();

  constructor(
    private localStorageService: LocalStorageService,
    private http: HttpClient
  ) {
    this.loadLangColors(); // Load colors on app start
  }

  // Set and update the selected language
  setCurrentLanguage(language: Language): void {
    this.currentLanguageSubject.next(language);
    this.localStorageService.saveCurrentLanguage(language); // Save in local storage
  }

  // Load the JSON file from assets or cache
  private loadLangColors(): void {
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
