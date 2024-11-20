import {Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {AppConstants} from "../../../app.constants";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";
import {AuthProvider, TokenInfo} from "./auth.types";
import {ResponseModel} from "../../../models/response.model";


@Injectable({
  providedIn: 'root',
})
export class AuthSettingsService {
  constructor(private http: HttpClient) {
  }

  checkCurrentAccessTokenIsLive(): Observable<string | null> {
    const url = `${AppConstants.AUTH_URL}/access-token/verify-live`;
    return this.http.get<ResponseModel>(url, {withCredentials: true}).pipe(
      map(response => response.success ? response.message! : null)
    );
  }

  // email change request
  requestEmailChange(email: string): Observable<any> {
    const url = `${AppConstants.EMAIL_CHANGE_REQUEST_URL}`;
    return this.http.post<any>(url, {email}, {withCredentials: true});
  }

  cancelEmailChangeRequest(): Observable<any> {
    const url = `${AppConstants.EMAIL_CHANGE_REQUEST_URL}`;
    return this.http.delete<any>(url, {withCredentials: true});
  }

  resendEmailChangeRequest(): Observable<void> {
    const url = `${AppConstants.EMAIL_CHANGE_REQUEST_URL}/resend`;
    return this.http.post<void>(url, {}, {withCredentials: true});
  }

  // email verification requests
  requestEmailVerification(): Observable<void> {
    const url = `${AppConstants.EMAIL_VERIFICATION_URL}/request`;
    return this.http.post<void>(url, {}, {withCredentials: true});
  }

  getLastEmailVerificationToken(): Observable<TokenInfo> {
    const url = `${AppConstants.EMAIL_VERIFICATION_URL}/last-token`;
    return this.http.get<TokenInfo>(url, {withCredentials: true});
  }

  // sensitive
  changePassword(newPassword: string): Observable<void> {
    const url = `${AppConstants.AUTH_URL}/password`;
    return this.http.put<void>(url, {password: newPassword}, {withCredentials: true});
  }

  deleteAccount(): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/me`;
    return this.http.delete(url, {withCredentials: true});
  }

  unlinkAuthProvider(provider: string): Observable<boolean> {
    const url = `${AppConstants.AUTH_URL}/providers/${provider.toUpperCase()}`;
    return this.http.delete<{ reauthRequired: boolean }>(url, {withCredentials: true})
      .pipe(
        map(response => response.reauthRequired)
      );
  }

  // auth data retrieval
  getAuthMethods(): Observable<AuthProvider[]> {
    const url = `${AppConstants.AUTH_URL}/providers`;
    return this.http.get<AuthProvider[]>(url, {withCredentials: true});
  }

  isEmailAvailable(email: string): Observable<boolean> {
    const url = `${AppConstants.AUTH_URL}/email/availability`;
    return this.http.post<boolean>(url, {email}, {withCredentials: true});
  }
}
