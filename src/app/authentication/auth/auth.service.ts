import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {UserInfoService} from "../../services/user-info.service";

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient,
              private userService: UserInfoService,
  ) {
  }

  linkLocalWithNewEmail(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/email-changes/link-local`;
    return this.http.post(url, {email, password}, {withCredentials: true});
  }

  linkLocalAccount(password: string): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/local`;
    return this.http.post(url, {password}, {withCredentials: true});
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
    return this.http.post(`${AppConstants.VERIFICATION_AUTH_URL}/emails?token=${token}`, {});
  }

  changeEmail(token: string): Observable<any> {
    return this.http.post(`${AppConstants.VERIFICATION_AUTH_URL}/emails/change?token=${token}`, {});
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${AppConstants.VERIFICATION_AUTH_URL}/passwords`, {
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
