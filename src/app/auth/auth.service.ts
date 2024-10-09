import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';
import {tap} from "rxjs/operators";

const USER_INFO_KEY = 'user_info';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {
  }

  // Save user info in local storage
  saveUserInfo(userInfo: any): void {
    window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  }

  // Retrieve user info from local storage
  getLocalUserInfo(): any {
    const data = window.localStorage.getItem(USER_INFO_KEY);
    return data ? JSON.parse(data) : null;
  }

  // Fetch user info from the backend
  getUserInfo(): Observable<any> {
    const url = `${AppConstants.API_URL}/users/me`;
    return this.http.get(url, {withCredentials: true}).pipe(
      tap((userInfo: any) => {
        this.saveUserInfo(userInfo); // Save to local storage after fetching
      })
    );
  }

  login(email: string, password: string): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/login`;
    return this.http.post(url, {email, password}, {withCredentials: true});
  }

  register(email: string, password: string): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/register`;
    return this.http.post(url, {email, password});
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.post(`${AppConstants.PUBLIC_AUTH_URL}/verify-email?token=${token}`, {});
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${AppConstants.PUBLIC_AUTH_URL}/reset-password`, {
      token,
      newPassword
    });
  }

  forgotPassword(email: string): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/forgot-password`;
    return this.http.post(url, {email});
  }

  refreshToken(): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/refresh-token`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  logout(): Observable<void> {
    localStorage.removeItem(USER_INFO_KEY);
    return this.http.post<void>(`${AppConstants.AUTH_URL}/logout`, {}, {withCredentials: true});
  }

  logoutPublic(): Observable<void> {
    return this.http.post<void>(`${AppConstants.PUBLIC_AUTH_URL}/logout`, {}, {withCredentials: true});
  }
}
