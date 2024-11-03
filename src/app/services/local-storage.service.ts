import {Injectable} from '@angular/core';
import {Language} from "../models/language.enum";

const USER_INFO_KEY = 'user_info';

const CURRENT_LANGUAGE = 'current_language';
const LANG_COLOR_KEY = 'langColors';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  // universal methods for saving, getting and removing items from local storage
  public saveItem(key: string, value: any): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  }

  public getItem<T>(key: string): T | null {
    try {
      const data = window.localStorage.getItem(key);
      return data ? JSON.parse(data) as T : null;
    } catch (e) {
      console.error('Error reading from localStorage', e);
      return null;
    }
  }

  public removeItem(key: string): void {
    window.localStorage.removeItem(key);
  }

  saveUserInfo(userInfo: any): void {
    this.saveItem(USER_INFO_KEY, userInfo);
  }

  getUserInfo(): any {
    return this.getItem<any>(USER_INFO_KEY);
  }

  clearUserInfo(): void {
    this.removeItem(USER_INFO_KEY);
  }

  saveCurrentLanguage(language: Language): void {
    this.saveItem(CURRENT_LANGUAGE, language);
  }

  getCurrentLanguage(): Language {
    return this.getItem<Language>(CURRENT_LANGUAGE) || Language.EN;
  }

  saveLangColors(colors: { [key: string]: string }): void {
    this.saveItem(LANG_COLOR_KEY, colors);
  }

  getLangColors(): { [key: string]: string } | null {
    return this.getItem<{ [key: string]: string }>(LANG_COLOR_KEY);
  }
}
