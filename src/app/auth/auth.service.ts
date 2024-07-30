import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {
  }

  private tokenKey = 'accessToken';

  login(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_API}/public/login`;
    return this.http.post(url, {email, password});
  }

  register(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_API}/public/register`;
    return this.http.post(url, {email, password});
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.post(`${AppConstants.AUTH_API}/public/verify-email?token=${token}`, {});
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${AppConstants.AUTH_API}/public/reset-password`, {
      token,
      newPassword
    });
  }

  forgotPassword(email: string): Observable<any> {
    const url = `${AppConstants.AUTH_API}/public/forgot-password`;
    return this.http.post(url, {email});
  }

  storeToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
  }
}
