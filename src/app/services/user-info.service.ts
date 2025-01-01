import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {catchError, map, tap} from 'rxjs/operators';
import {UserInfo} from "../models/userinfo.model";
import {LocalStorageService} from "./local-storage.service";
import {AppConstants} from "../app.constants";

@Injectable({
  providedIn: 'root',
})
export class UserInfoService {
  private userInfoSubject = new BehaviorSubject<UserInfo | null>(null);
  userInfo$ = this.userInfoSubject.asObservable();

  constructor(
    private http: HttpClient,
    private localStorageService: LocalStorageService
  ) {
    this.loadUserInfoFromLocalStorage();
  }

  /**
   * Load user info from local storage or from server.
   */
  loadUserInfo(): Observable<UserInfo | null> {
    const cachedUserInfo = this.getCurrentUserInfo();

    if (cachedUserInfo) {
      return of(cachedUserInfo); // Return the cached user info if present
    } else {
      return this.fetchUserInfoFromServer(); // Fetch from server if not cached
    }
  }

  clearUserInfo(): void {
    this.localStorageService.clearUserInfo();
    this.userInfoSubject.next(null);
  }

  private loadUserInfoFromLocalStorage(): void {
    const cachedUserInfo = this.localStorageService.getUserInfo();
    if (cachedUserInfo) {
      const userInfoInstance = UserInfo.fromJSON(cachedUserInfo);
      this.userInfoSubject.next(userInfoInstance);
    }
  }

  /**
   * Fetch user info from the server.
   */
  fetchUserInfoFromServer(): Observable<UserInfo | null> {
    return this.http.get<UserInfo>(`${AppConstants.ME_URL}`, {withCredentials: true}).pipe(
      map((data) => UserInfo.fromJSON(data)),
      tap((userInfo: UserInfo) => {
        this.localStorageService.saveUserInfo(userInfo); // Cache in local storage
        this.userInfoSubject.next(userInfo); // Update the subject
      }),
      catchError((error) => {
        console.error('Failed to load user info from server:', error);
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

  private getCurrentUserInfo(): UserInfo | null {
    return this.userInfoSubject.getValue();
  }
}
