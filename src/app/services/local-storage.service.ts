import {logger} from "../shared/logger";
import {Injectable} from '@angular/core';
import {LanguageCode} from "../models/language.enum";
import {AuthMethod} from "../authentication/auth/auth.types";
import {Language} from "../models/language.model";
import {DEFAULT_PARALLEL_MODE, ParallelMode} from "../sections/read/parallel-mode.type";
import {UserInfo, UserInfoData} from "../models/userinfo.model";

const PARALLEL_MODE_KEY = 'parallel_mode';
const USER_INFO_KEY = 'user_info';
const CURRENT_LANGUAGE_KEY = 'current_language';
const LANG_COLOR_KEY = 'langColors';
const AUTH_METHODS_KEY = 'auth_methods';
const SUPPORTED_LANGUAGES_KEY = 'supported_languages';
const LAST_SEEN_KEY = 'last_seen_users';
const TIMER_END_TIMESTAMP_KEY = 'timer_end_timestamp';
const READER_POSITIONS_KEY = 'reader_positions';
const ONBOARDING_DRAFTS_KEY = 'onboarding_drafts';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  // universal methods for saving, getting and removing items from local storage
  public saveItem(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      logger.error('Error saving to localStorage', e);
    }
  }

  public getItem<T>(key: string): T | null {
    try {
      const data = window.localStorage.getItem(key);
      return data ? JSON.parse(data) as T : null;
    } catch (e) {
      logger.error('Error reading from localStorage', e);
      return null;
    }
  }

  public removeItem(key: string): void {
    window.localStorage.removeItem(key);
  }

  saveUserInfo(userInfo: UserInfo): void {
    this.saveItem(USER_INFO_KEY, userInfo);
  }

  getUserInfo(): UserInfoData | null {
    const storedUserInfo = this.getItem<UserInfoData & {streamChatToken?: string}>(USER_INFO_KEY);
    if (storedUserInfo && Object.hasOwn(storedUserInfo, 'streamChatToken')) {
      const safeUserInfo = {...storedUserInfo};
      delete safeUserInfo.streamChatToken;
      this.saveItem(USER_INFO_KEY, safeUserInfo);
      return safeUserInfo;
    }
    return storedUserInfo;
  }

  clearUserInfo(): void {
    this.removeItem(USER_INFO_KEY);
  }

  saveCurrentLanguage(language: LanguageCode): void {
    this.saveItem(CURRENT_LANGUAGE_KEY, language);
  }

  getCurrentLanguage(): LanguageCode {
    return this.getItem<LanguageCode>(CURRENT_LANGUAGE_KEY) ?? LanguageCode.EN;
  }

  removeCurrentLanguage(): void {
    this.removeItem(CURRENT_LANGUAGE_KEY);
  }

  saveLangColors(colors: Record<string, string>): void {
    this.saveItem(LANG_COLOR_KEY, colors);
  }

  getLangColors(): Record<string, string> | null {
    return this.getItem<Record<string, string>>(LANG_COLOR_KEY);
  }

  clearLangColors(): void {
    this.removeItem(LANG_COLOR_KEY);
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
    const lastSeenData = this.getItem<Record<string, string>>(LAST_SEEN_KEY) ?? {};
    lastSeenData[userId] = timestamp.toISOString();
    this.saveItem(LAST_SEEN_KEY, lastSeenData);
  }

  // Retrieve last seen timestamp for a user
  getLastSeen(userId: string): Date | null {
    const lastSeenData = this.getItem<Record<string, string>>(LAST_SEEN_KEY);
    return lastSeenData?.[userId] ? new Date(lastSeenData[userId]) : null;
  }

  removeLastSeen(): void {
    this.removeItem(LAST_SEEN_KEY);
  }

  saveTimerEndTimestamp(endTime: number): void {
    this.saveItem(TIMER_END_TIMESTAMP_KEY, endTime);
  }

  getTimerEndTimestamp(): number | null {
    return this.getItem<number>(TIMER_END_TIMESTAMP_KEY);
  }

  clearTimer(): void {
    this.removeItem(TIMER_END_TIMESTAMP_KEY);
  }

  clearReaderPositions(): void {
    this.removeItem(READER_POSITIONS_KEY);
  }

  /** Unsubmitted onboarding answers, kept per user so a second account on the same browser never inherits them. */
  saveOnboardingDraft<T>(userId: string, draft: T): void {
    const drafts = this.getItem<Record<string, T>>(ONBOARDING_DRAFTS_KEY) ?? {};
    drafts[userId] = draft;
    this.saveItem(ONBOARDING_DRAFTS_KEY, drafts);
  }

  getOnboardingDraft<T>(userId: string): T | null {
    return this.getItem<Record<string, T>>(ONBOARDING_DRAFTS_KEY)?.[userId] ?? null;
  }

  clearOnboardingDrafts(): void {
    this.removeItem(ONBOARDING_DRAFTS_KEY);
  }

  saveParallelMode(mode: ParallelMode): void {
    this.saveItem(PARALLEL_MODE_KEY, mode);
  }

  getParallelMode(): ParallelMode {
    const storedMode = this.getItem<string>(PARALLEL_MODE_KEY);
    if (storedMode === 'side' || storedMode === 'overlay' || storedMode === 'inline') {
      return storedMode;
    }
    return DEFAULT_PARALLEL_MODE;
  }

  clearParallelMode(): void {
    this.removeItem(PARALLEL_MODE_KEY);
  }

  public clearUserRelatedData(): void {
    this.clearUserInfo();
    this.removeCurrentLanguage();
    this.clearAuthMethods();
    this.clearParallelMode();
    this.clearReaderPositions();
    this.clearOnboardingDrafts();
  }

  public clearAllData(): void {
    this.clearUserRelatedData();
    this.removeSupportedLanguages();
    this.removeLastSeen();
    this.clearLangColors();
    this.clearTimer();
  }
}
