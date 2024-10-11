import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';
import {UserService} from "../services/user.service";

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient,
              private userService: UserService,
  ) {
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
    this.userService.clearUserInfo();
    return this.http.post<void>(`${AppConstants.AUTH_URL}/logout`, {}, {withCredentials: true});
  }

  logoutPublic(): Observable<void> {
    return this.http.post<void>(`${AppConstants.PUBLIC_AUTH_URL}/logout`, {}, {withCredentials: true});
  }
}
