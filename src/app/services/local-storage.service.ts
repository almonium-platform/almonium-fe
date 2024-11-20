import {Injectable} from '@angular/core';
import {LanguageCode} from "../models/language.enum";
import {AuthProvider} from "../sections/settings/auth/auth.types";

const USER_INFO_KEY = 'user_info';

const CURRENT_LANGUAGE = 'current_language';
const LANG_COLOR_KEY = 'langColors';
const AUTH_METHODS_KEY = 'auth_methods';

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
    this.saveItem(CURRENT_LANGUAGE, language);
  }

  getCurrentLanguage(): LanguageCode {
    return this.getItem<LanguageCode>(CURRENT_LANGUAGE) || LanguageCode.EN;
  }

  saveLangColors(colors: { [key: string]: string }): void {
    this.saveItem(LANG_COLOR_KEY, colors);
  }

  getLangColors(): { [key: string]: string } | null {
    return this.getItem<{ [key: string]: string }>(LANG_COLOR_KEY);
  }

  saveAuthMethods(authMethods: AuthProvider[]): void {
    this.saveItem(AUTH_METHODS_KEY, authMethods);
  }

  getAuthMethods(): AuthProvider[] | null {
    return this.getItem<AuthProvider[]>(AUTH_METHODS_KEY);
  }

  clearAuthMethods(): void {
    this.removeItem(AUTH_METHODS_KEY);
  }
}
