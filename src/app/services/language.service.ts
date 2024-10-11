import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {LocalStorageService} from './local-storage.service';
import {Language} from '../models/language.enum';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  // Use BehaviorSubject to maintain the current selected language
  private currentLanguageSubject = new BehaviorSubject<Language>(this.localStorageService.getCurrentLanguage());
  currentLanguage$ = this.currentLanguageSubject.asObservable();

  constructor(private localStorageService: LocalStorageService) {
  }

  // Set and update the selected language
  setCurrentLanguage(language: Language): void {
    this.currentLanguageSubject.next(language);
    this.localStorageService.saveCurrentLanguage(language); // Save in local storage
  }
}
