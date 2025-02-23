import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {catchError, map, tap} from 'rxjs/operators';
import {LocalStorageService} from './local-storage.service';
import {Language} from '../models/language.model';
import {LanguageNameService} from "./language-name.service";
import {LanguageCode} from "../models/language.enum";
import {StaticInfoService} from "./static-info.service"; // Assuming a Language model exists
@Injectable({
  providedIn: 'root',
})
export class SupportedLanguagesService {
  private supportedLanguagesSubject = new BehaviorSubject<Language[] | null>(null);
  supportedLanguages$ = this.supportedLanguagesSubject.asObservable();

  constructor(
    private staticInfoService: StaticInfoService,
    private localStorageService: LocalStorageService,
    private languageNameService: LanguageNameService
  ) {
    this.loadSupportedLanguages();
  }

  /**
   * Load supported languages from cache or server.
   */
  loadSupportedLanguages(): void {
    const cachedLanguages = this.localStorageService.getSupportedLanguages();

    if (cachedLanguages) {
      // If we have cached data, use it
      this.supportedLanguagesSubject.next(cachedLanguages);
    } else {
      // If no cached data, fetch from server
      this.getAllSupportedLanguages().subscribe();
    }
  }

  clearSupportedLanguages(): void {
    this.supportedLanguagesSubject.next(null);
    this.localStorageService.removeSupportedLanguages();
  }

  /**
   * Fetch supported languages from the server and cache them.
   */
  public getAllSupportedLanguages(): Observable<Language[]> {
    return this.staticInfoService.getSupportedLanguages().pipe(
      map((languageCodes) => {
        return languageCodes.map((code) => {
          return {
            code: code as LanguageCode,
            name: this.languageNameService.getLanguageName(code),
          };
        }).filter((lang): lang is Language => lang !== null); // Filtering out null
      }),
      tap((languages) => {
        this.supportedLanguagesSubject.next(languages);
        this.cacheSupportedLanguages(languages);
      }),
      catchError((error) => {
        console.error('Error fetching supported languages:', error);
        return of([]); // Return an empty array in case of error
      })
    );
  }

  private cacheSupportedLanguages(languages: Language[]): void {
    this.localStorageService.saveSupportedLanguages(languages);
  }
}
