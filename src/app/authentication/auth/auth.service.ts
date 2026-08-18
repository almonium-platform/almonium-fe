import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, from, map, Observable, of, switchMap, tap} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {UserInfoService} from '../../services/user-info.service';
import {LocalStorageService} from '../../services/local-storage.service';
import {PopupTemplateStateService} from '../../shared/modals/popup-template/popup-template-state.service';
import {UserInfo, UserInfoDto} from '../../models/userinfo.model';
import {authMethodsFromFirebaseUser} from './auth-methods';
import {Auth} from '@angular/fire/auth';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getIdToken,
  GoogleAuthProvider,
  inMemoryPersistence,
  linkWithCredential,
  linkWithPopup,
  OAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';

@Injectable({providedIn: 'root'})
export class AuthService {
  private http = inject(HttpClient);
  private firebaseAuth = inject(Auth);
  private userInfoService = inject(UserInfoService);
  private localStorageService = inject(LocalStorageService);
  private popupTemplateStateService = inject(PopupTemplateStateService);

  private readonly ready: Promise<void>;

  constructor() {
    this.ready = setPersistence(this.firebaseAuth, inMemoryPersistence);
  }

  login(email: string, password: string): Observable<UserInfo> {
    return from(this.ready).pipe(
      switchMap(() => from(signInWithEmailAndPassword(this.firebaseAuth, email, password))),
      switchMap(credential => this.exchangeSession(credential.user)),
    );
  }

  googleSignIn(mode: 'sign-in' | 'reauth' | 'link' = 'sign-in'): Observable<UserInfo> {
    const provider = new GoogleAuthProvider();
    return this.providerSignIn(provider, mode);
  }

  appleSignIn(mode: 'sign-in' | 'reauth' | 'link' = 'sign-in'): Observable<UserInfo> {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    return this.providerSignIn(provider, mode);
  }

  private providerSignIn(
    provider: GoogleAuthProvider | OAuthProvider,
    mode: 'sign-in' | 'reauth' | 'link',
  ): Observable<UserInfo> {
    return from(this.ready).pipe(
      switchMap(() => {
        const user = this.firebaseAuth.currentUser;
        if (mode === 'link') {
          if (!user) throw new Error('Reauthenticate before linking an account');
          return from(linkWithPopup(user, provider));
        }
        if (mode === 'reauth' && user) return from(reauthenticateWithPopup(user, provider));
        return from(signInWithPopup(this.firebaseAuth, provider));
      }),
      switchMap(credential => this.exchangeSession(credential.user)),
    );
  }

  register(email: string, password: string): Observable<{message: string}> {
    return from(this.ready).pipe(
      switchMap(() => from(createUserWithEmailAndPassword(this.firebaseAuth, email, password))),
      switchMap(credential => this.requestEmailVerification(credential.user)),
      switchMap(() => from(signOut(this.firebaseAuth))),
      switchMap(() => of({message: 'Next step, verify your email!'})),
    );
  }

  reauth(password: string): Observable<UserInfo> {
    const email = this.userInfoService.currentUserInfo?.email;
    if (!email) throw new Error('Current user email is unavailable');
    const current = this.firebaseAuth.currentUser;
    const authentication = current
      ? reauthenticateWithCredential(current, EmailAuthProvider.credential(email, password))
      : signInWithEmailAndPassword(this.firebaseAuth, email, password);
    return from(authentication).pipe(switchMap(credential => this.exchangeSession(credential.user)));
  }

  linkLocalAccount(password: string): Observable<UserInfo> {
    const user = this.requireCurrentUser();
    const email = this.userInfoService.currentUserInfo?.email;
    if (!email) throw new Error('Current user email is unavailable');
    return from(linkWithCredential(user, EmailAuthProvider.credential(email, password))).pipe(
      switchMap(credential => this.exchangeSession(credential.user)),
    );
  }

  linkLocalWithNewEmail(email: string, password: string): Observable<void> {
    const user = this.requireCurrentUser();
    return from(linkWithCredential(user, EmailAuthProvider.credential(email, password))).pipe(
      switchMap(() => from(verifyBeforeUpdateEmail(user, email))),
    );
  }

  forgotPassword(email: string): Observable<{message: string}> {
    return this.http.post<{message: string}>(`${AppConstants.PUBLIC_AUTH_URL}/password-resets`, {email});
  }

  verifyEmail(code: string): Observable<void> {
    return from(applyActionCode(this.firebaseAuth, code));
  }

  changeEmail(code: string): Observable<void> {
    return this.http.post<void>(`${AppConstants.PUBLIC_AUTH_URL}/email-changes?token=${encodeURIComponent(code)}`, {});
  }

  resetPassword(code: string, newPassword: string): Observable<void> {
    return from(confirmPasswordReset(this.firebaseAuth, code, newPassword));
  }

  validateResetPasswordToken(code: string): Observable<boolean> {
    return from(checkActionCode(this.firebaseAuth, code)).pipe(switchMap(() => of(true)));
  }

  refreshSession(): Observable<UserInfo> {
    return this.exchangeSession(this.requireCurrentUser());
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${AppConstants.AUTH_URL}/session/logout`, {}, {withCredentials: true}).pipe(
      catchError(() => of(undefined)),
      switchMap(() => from(signOut(this.firebaseAuth))),
      tap(() => this.clearApplicationAuthState()),
    );
  }

  logoutPublic(): Observable<void> {
    return this.logout();
  }

  currentUser(): User | null {
    return this.firebaseAuth.currentUser;
  }

  private exchangeSession(user: User): Observable<UserInfo> {
    return from(getIdToken(user, true)).pipe(
      switchMap(idToken => this.http.post<UserInfoDto>(
        `${AppConstants.AUTH_URL}/session`,
        {idToken},
        {withCredentials: true},
      )),
      tap(userInfo => {
        this.userInfoService.setUserInfo(userInfo);
        this.localStorageService.saveAuthMethods(authMethodsFromFirebaseUser(user));
      }),
      map(() => this.userInfoService.currentUserInfo!),
    );
  }

  private requestEmailVerification(user: User): Observable<void> {
    return from(getIdToken(user, true)).pipe(
      switchMap(idToken => this.http.post<void>(
        `${AppConstants.PUBLIC_AUTH_URL}/email-verification`,
        {idToken},
      )),
    );
  }

  private requireCurrentUser(): User {
    const user = this.firebaseAuth.currentUser;
    if (!user) throw new Error('Recent Firebase sign-in required');
    return user;
  }

  private clearApplicationAuthState(): void {
    this.popupTemplateStateService.close();
    this.localStorageService.clearUserRelatedData();
    this.userInfoService.clearUserInfo();
  }
}
