import {Injectable} from '@angular/core';
import {Language} from "../models/language.enum";

const USER_INFO_KEY = 'user_info';

const CURRENT_LANGUAGE = 'current_language';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {
  saveUserInfo(userInfo: any): void {
    window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  }

  getUserInfo(): any {
    const data = window.localStorage.getItem(USER_INFO_KEY);
    return data ? JSON.parse(data) : null;
  }

  clearUserInfo(): void {
    window.localStorage.removeItem(USER_INFO_KEY);
  }

  saveCurrentLanguage(language: Language): void {
    window.localStorage.setItem(CURRENT_LANGUAGE, language);
  }

  getCurrentLanguage(): Language {
    return (window.localStorage.getItem(CURRENT_LANGUAGE) as Language) || Language.EN;
  }
}
