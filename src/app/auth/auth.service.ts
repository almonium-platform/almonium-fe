import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient) {}
  private tokenKey = 'accessToken';

  login(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_API}/public/login`;
    return this.http.post(url, { email, password });
  }

  register(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_API}/public/register`;
    return this.http.post(url, { email, password });
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
