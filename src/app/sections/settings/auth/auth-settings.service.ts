import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {from, map, Observable, of, switchMap, tap} from 'rxjs';
import {AppConstants} from '../../../app.constants';
import {AuthMethod, TokenInfo} from '../../../authentication/auth/auth.types';
import {authMethodsFromFirebaseUser} from '../../../authentication/auth/auth-methods';
import {ResponseModel} from '../../../models/response.model';
import {LocalStorageService} from '../../../services/local-storage.service';
import {
  Auth,
  sendEmailVerification,
  signOut,
  unlink,
  updatePassword,
  verifyBeforeUpdateEmail,
} from '@angular/fire/auth';

@Injectable({providedIn: 'root'})
export class AuthSettingsService {
  private http = inject(HttpClient);
  private firebaseAuth = inject(Auth);
  private localStorageService = inject(LocalStorageService);


  checkCurrentAccessTokenIsLive(): Observable<string | null> {
    return this.http.get<ResponseModel>(`${AppConstants.AUTH_URL}/session/recent`, {withCredentials: true}).pipe(
      map(response => response.success ? response.message! : null),
    );
  }

  requestEmailChange(email: string): Observable<void> {
    return from(verifyBeforeUpdateEmail(this.requireUser(), email));
  }

  requestEmailVerification(): Observable<void> {
    return from(sendEmailVerification(this.requireUser()));
  }

  cancelEmailVerificationRequest(): Observable<void> {
    return of(undefined);
  }

  resendEmailVerificationRequest(): Observable<void> {
    return this.requestEmailVerification();
  }

  getLastEmailVerificationToken(): Observable<TokenInfo | null> {
    return of(null);
  }

  changePassword(newPassword: string): Observable<void> {
    return from(updatePassword(this.requireUser(), newPassword));
  }

  deleteAccount(): Observable<void> {
    this.requireUser();
    return this.http.delete<void>(`${AppConstants.AUTH_URL}/me`, {withCredentials: true}).pipe(
      switchMap(() => from(signOut(this.firebaseAuth))),
    );
  }

  unlinkAuthProvider(provider: string): Observable<boolean> {
    const providerId = provider.toLowerCase() === 'local' ? 'password' : `${provider.toLowerCase()}.com`;
    return from(unlink(this.requireUser(), providerId)).pipe(map(() => false));
  }

  getAuthMethods(): Observable<AuthMethod[]> {
    return from(this.firebaseAuth.authStateReady()).pipe(
      map(() => {
        const user = this.firebaseAuth.currentUser;
        return user ? authMethodsFromFirebaseUser(user) : [];
      }),
      tap(methods => {
        if (this.firebaseAuth.currentUser) {
          this.localStorageService.saveAuthMethods(methods);
        }
      }),
    );
  }

  isEmailAvailable(email: string): Observable<boolean> {
    return of(email.length > 0);
  }

  populateAuthMethods(): Observable<AuthMethod[]> {
    return this.getAuthMethods().pipe(
      switchMap(methods => {
        if (this.firebaseAuth.currentUser) {
          return of(methods);
        }

        const cachedMethods = this.localStorageService.getAuthMethods();
        if (cachedMethods) {
          return of(cachedMethods);
        }

        return this.http.get<AuthMethod[]>(
          `${AppConstants.AUTH_URL}/session/providers`,
          {withCredentials: true},
        ).pipe(tap(providers => this.localStorageService.saveAuthMethods(providers)));
      }),
    );
  }

  private requireUser() {
    const user = this.firebaseAuth.currentUser;
    if (!user) throw new Error('Recent Firebase sign-in required');
    return user;
  }
}
