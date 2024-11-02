import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AppConstants} from "../../app.constants";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";


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

  unlinkAuthProvider(provider: string): Observable<boolean> {
    const url = `${AppConstants.AUTH_URL}/providers/${provider.toUpperCase()}`;
    return this.http.delete<{ reauthRequired: boolean }>(url, {withCredentials: true})
      .pipe(
        map(response => response.reauthRequired)
      );
  }

  getAuthProviders(): Observable<string[]> {
    const url = `${AppConstants.AUTH_URL}/providers`;
    return this.http.get<string[]>(url, {withCredentials: true});
  }

  deleteAccount(): Observable<any> {
    const url = `${AppConstants.USERS_URL}/me`;
    return this.http.delete(url, {withCredentials: true});
  }

  isEmailAvailable(email: string): Observable<boolean> {
    const url = `${AppConstants.AUTH_URL}/email-availability`;
    return this.http.post<boolean>(url, {email}, {withCredentials: true});
  }

  requestEmailChange(email: string): Observable<any> {
    const url = `${AppConstants.EMAIL_CHANGE_REQUEST_URL}`;
    return this.http.post<any>(url, {email}, {withCredentials: true});
  }

  changePassword(newPassword: string): Observable<void> {
    const url = `${AppConstants.AUTH_URL}/password`;
    return this.http.put<void>(url, {password: newPassword}, {withCredentials: true});
  }

  requestEmailVerification(): Observable<void> {
    const url = `${AppConstants.AUTH_URL}/email-verification/request`;
    return this.http.post<void>(url, {}, {withCredentials: true});
  }
}
