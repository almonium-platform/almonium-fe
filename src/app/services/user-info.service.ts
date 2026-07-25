import {logger} from "../shared/logger";
import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {catchError, map, tap} from 'rxjs/operators';
import {UserInfo, UserInfoDto, parseUserInfoDto} from "../models/userinfo.model";
import {LocalStorageService} from "./local-storage.service";
import {AppConstants} from "../app.constants";
import {AppHttpError} from '../shared/app-http-error';

@Injectable({
  providedIn: 'root',
})
export class UserInfoService {
  private http = inject(HttpClient);
  private localStorageService = inject(LocalStorageService);

  private userInfoSubject = new BehaviorSubject<UserInfo | null>(null);
  private sessionVerified = false;
  private streamChatTokenValue: string | null = null;
  userInfo$ = this.userInfoSubject.asObservable();

  constructor() {
    // Trigger removal of tokens persisted by older client versions without
    // hydrating authentication state from the remaining cached profile.
    this.localStorageService.getUserInfo();
  }

  /** Returns user info only after the current server session has been verified. */
  loadUserInfo(): Observable<UserInfo | null> {
    if (this.sessionVerified) {
      return of(this.currentUserInfo);
    }
    return this.fetchUserInfoFromServer();
  }

  clearUserInfo(): void {
    this.localStorageService.clearUserInfo();
    this.sessionVerified = false;
    this.streamChatTokenValue = null;
    this.userInfoSubject.next(null);
  }

  /**
   * Fetch user info from the server.
   */
  fetchUserInfoFromServer(): Observable<UserInfo | null> {
    return this.http.get<unknown>(`${AppConstants.ME_URL}`, {withCredentials: true}).pipe(
      map((data) => {
        return parseUserInfoDto(data);
      }),
      tap(({userInfo, streamChatToken}) => {
        this.streamChatTokenValue = streamChatToken;
        this.sessionVerified = true;
        this.localStorageService.saveUserInfo(userInfo);
        this.userInfoSubject.next(userInfo);
      }),
      map(({userInfo}) => userInfo),
      catchError((error) => {
        logger.error('Failed to load user info from server:', error);
        this.sessionVerified = false;
        this.streamChatTokenValue = null;
        if (error instanceof AppHttpError && (error.status === 401 || error.status === 403)) {
          this.clearUserInfo();
        }
        return of(null);
      })
    );
  }

  updateUserInfo(updates: Partial<UserInfo>): void {
    const currentUserInfo = this.getCurrentUserInfo();
    if (currentUserInfo) {
      const updatedUserInfo = currentUserInfo.update(updates);
      this.localStorageService.saveUserInfo(updatedUserInfo);
      this.userInfoSubject.next(updatedUserInfo); // Notify subscribers
    }
  }

  get currentUserInfo(): UserInfo | null {
    return this.userInfoSubject.getValue();
  }

  get streamChatToken(): string | null {
    return this.streamChatTokenValue;
  }

  setUserInfo(userInfoData: UserInfoDto): void {
    const {userInfo, streamChatToken} = parseUserInfoDto(userInfoData);
    this.streamChatTokenValue = streamChatToken;
    this.sessionVerified = true;
    this.localStorageService.saveUserInfo(userInfo);
    this.userInfoSubject.next(userInfo);
  }

  private getCurrentUserInfo(): UserInfo | null {
    return this.currentUserInfo;
  }
}
