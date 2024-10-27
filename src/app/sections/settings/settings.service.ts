import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AppConstants} from "../../app.constants";
import {Observable} from "rxjs";


@Injectable({
  providedIn: 'root',
})
export class SettingService {
  constructor(private http: HttpClient) {
  }

  isEmailVerified(): Observable<boolean> {
    const url = `${AppConstants.AUTH_URL}/email-verified`;
    return this.http.get<boolean>(url, {withCredentials: true});
  }

  checkCurrentAccessToken(): Observable<boolean> {
    const url = `${AppConstants.AUTH_URL}/access-token/verify-live`;
    return this.http.get<boolean>(url, {withCredentials: true});
  }

  unlinkAuthProvider(provider: string): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/providers/${provider}`;
    return this.http.delete(url, {withCredentials: true});
  }

  getAuthProviders(): Observable<string[]> {
    const url = `${AppConstants.AUTH_URL}/providers`;
    return this.http.get<string[]>(url, {withCredentials: true});
  }

  deleteAccount(): Observable<any> {
    const url = `${AppConstants.USERS_URL}/me`;
    return this.http.delete(url, {withCredentials: true});
  }
}
