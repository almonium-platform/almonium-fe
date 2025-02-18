import {Injectable} from '@angular/core';
import {LanguageCode} from "../models/language.enum";
import {AuthMethod} from "../authentication/auth/auth.types";
import {Language} from "../models/language.model";

const USER_INFO_KEY = 'user_info';
const CURRENT_LANGUAGE_KEY = 'current_language';
const LANG_COLOR_KEY = 'langColors';
const AUTH_METHODS_KEY = 'auth_methods';
const SUPPORTED_LANGUAGES_KEY = 'supported_languages';
const LAST_SEEN_KEY = 'last_seen_users';

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

  saveCurrentLanguage(language: LanguageCode): void {
    this.saveItem(CURRENT_LANGUAGE_KEY, language);
  }

  getCurrentLanguage(): LanguageCode {
    return this.getItem<LanguageCode>(CURRENT_LANGUAGE_KEY) || LanguageCode.EN;
  }

  clearCurrentLanguage(): void {
    this.removeItem(CURRENT_LANGUAGE_KEY);
  }

  saveLangColors(colors: { [key: string]: string }): void {
    this.saveItem(LANG_COLOR_KEY, colors);
  }

  getLangColors(): { [key: string]: string } | null {
    return this.getItem<{ [key: string]: string }>(LANG_COLOR_KEY);
  }

  saveAuthMethods(authMethods: AuthMethod[]): void {
    this.saveItem(AUTH_METHODS_KEY, authMethods);
  }

  getAuthMethods(): AuthMethod[] | null {
    return this.getItem<AuthMethod[]>(AUTH_METHODS_KEY);
  }

  clearAuthMethods(): void {
    this.removeItem(AUTH_METHODS_KEY);
  }


  // Specific methods for handling supported languages
  saveSupportedLanguages(languages: Language[]): void {
    this.saveItem(SUPPORTED_LANGUAGES_KEY, languages);
  }

  getSupportedLanguages(): Language[] | null {
    return this.getItem(SUPPORTED_LANGUAGES_KEY);
  }

  removeSupportedLanguages(): void {
    this.removeItem(SUPPORTED_LANGUAGES_KEY);
  }

  saveLastSeen(userId: string, timestamp: Date): void {
    const lastSeenData = this.getItem<{ [key: string]: string }>(LAST_SEEN_KEY) || {};
    lastSeenData[userId] = timestamp.toISOString();
    this.saveItem(LAST_SEEN_KEY, lastSeenData);
  }

  // Retrieve last seen timestamp for a user
  getLastSeen(userId: string): Date | null {
    const lastSeenData = this.getItem<{ [key: string]: string }>(LAST_SEEN_KEY);
    return lastSeenData?.[userId] ? new Date(lastSeenData[userId]) : null;
  }

  public clearUserRelatedData(): void {
    this.clearUserInfo();
    this.clearCurrentLanguage();
    this.clearAuthMethods();
  }
}
