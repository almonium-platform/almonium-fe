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

  getUserInfo(): Observable<any> {
    const url = `${AppConstants.API_URL}/users/me`;
    return this.http.get(url, {withCredentials: true});
  }

  clearCookies(): void {
    // Clear any stored tokens or session information
    document.cookie = 'accessToken=; Max-Age=0; path=/; domain=.api.almonium.com; Secure';
    document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/public/auth/refresh-token; domain=.api.almonium.com; Secure';
    console.log('Cookies cleared');
  }

  logout(): void {
    const url = `${AppConstants.AUTH_URL}/logout`;
    this.http.post(url, {}, {withCredentials: true}).subscribe({
      next: () => {
        console.log('User logged out successfully.');
      },
      error: (err) => {
        console.error('Logout failed', err);
      }
    });
    this.clearCookies();
  }
}
