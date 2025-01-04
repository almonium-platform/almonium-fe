import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AppConstants} from "../../../app.constants";
import {Observable, of} from "rxjs";
import {map, tap} from "rxjs/operators";
import {AuthMethod, TokenInfo} from "./auth.types";
import {ResponseModel} from "../../../models/response.model";
import {LocalStorageService} from "../../../services/local-storage.service";
import {TuiAlertService} from "@taiga-ui/core";


@Injectable({
  providedIn: 'root',
})
export class AuthSettingsService {
  constructor(private http: HttpClient,
              private localStorageService: LocalStorageService,
              private alertService: TuiAlertService,
  ) {
  }

  checkCurrentAccessTokenIsLive(): Observable<string | null> {
    const url = `${AppConstants.AUTH_URL}/access-token/verify-live`;
    return this.http.get<ResponseModel>(url, {withCredentials: true}).pipe(
      map(response => response.success ? response.message! : null)
    );
  }

  // email change request
  requestEmailChange(email: string): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/email/change`;
    return this.http.post<any>(url, {email}, {withCredentials: true});
  }

  // email verification requests
  requestEmailVerification(): Observable<void> {
    const url = `${AppConstants.EMAIL_VERIFICATION_URL}`;
    return this.http.post<void>(url, {}, {withCredentials: true});
  }

  cancelEmailVerificationRequest(): Observable<any> {
    const url = `${AppConstants.EMAIL_VERIFICATION_URL}`;
    return this.http.delete<any>(url, {withCredentials: true});
  }

  resendEmailVerificationRequest(): Observable<void> {
    const url = `${AppConstants.EMAIL_VERIFICATION_URL}/resend`;
    return this.http.post<void>(url, {}, {withCredentials: true});
  }

  getLastEmailVerificationToken(): Observable<TokenInfo> {
    const url = `${AppConstants.EMAIL_VERIFICATION_URL}/last/token`;
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
  getAuthMethods(): Observable<AuthMethod[]> {
    const url = `${AppConstants.AUTH_URL}/providers`;
    return this.http.get<AuthMethod[]>(url, {withCredentials: true});
  }

  isEmailAvailable(email: string): Observable<boolean> {
    const url = `${AppConstants.AUTH_URL}/email/availability`;
    return this.http.post<boolean>(url, {email}, {withCredentials: true});
  }

  populateAuthMethods(): Observable<AuthMethod[]> {
    const cachedAuthMethods = this.localStorageService.getAuthMethods();
    if (cachedAuthMethods) {
      return of(cachedAuthMethods);
    }
    return this.getAuthMethods().pipe(
      tap({
        next: (methods) => this.localStorageService.saveAuthMethods(methods),
        error: (error) => {
          console.error(error);
          this.alertService.open(error.error.message || 'Failed to get auth methods', {appearance: 'error'}).subscribe();
        }
      })
    );
  }
}
