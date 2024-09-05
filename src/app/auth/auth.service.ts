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
    return this.http.post(url, {email, password}, {withCredentials: true});
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

  refreshToken(): Observable<any> {
    const url = `${AppConstants.API_URL}/refresh`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  getUserInfo(): Observable<any> {
    const url = `${AppConstants.API_URL}/users/me`;
    return this.http.get(url, {withCredentials: true});
  }

  clearCookies(): void {
    // Clear any stored tokens or session information
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    document.cookie = 'refreshToken=; Max-Age=0; path=/api/v1/refresh';
  }

  logout(): void {
    this.clearCookies();
    const url = `${AppConstants.AUTH_API}/manage/logout`;
    this.http.post(url, {}, {withCredentials: true}).subscribe({
      next: () => {
        console.log('User logged out successfully.');
      },
      error: (err) => {
        console.error('Logout failed', err);
      }
    });
  }
}
