import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {UserInfoService} from "../../services/user-info.service";
import {LocalStorageService} from "../../services/local-storage.service";
import {PopupTemplateStateService} from "../../shared/modals/popup-template/popup-template-state.service";
import {switchMap, tap} from "rxjs/operators";
import {UserInfo} from "../../models/userinfo.model";

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private http: HttpClient,
              private userInfoService: UserInfoService,
              private localStorageService: LocalStorageService,
              private popupTemplateStateService: PopupTemplateStateService,
  ) {
  }

  linkLocalWithNewEmail(email: string, password: string): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/local/migrate`;
    return this.http.post(url, {email, password}, {withCredentials: true});
  }

  linkLocalAccount(password: string): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/local/link`;
    return this.http.post(url, {password}, {withCredentials: true});
  }

  public login(email: string, password: string): Observable<UserInfo | null> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/login`;
    return this.http.post<void>(url, {email, password}, {withCredentials: true})
      .pipe(
        switchMap(() => this.userInfoService.fetchUserInfoFromServer())
      );
  }

  reauth(password: string): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/reauth`;
    return this.http.post(url, {password}, {withCredentials: true});
  }

  register(email: string, password: string): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/register`;
    return this.http.post(url, {email, password});
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.post(`${AppConstants.VERIFICATION_AUTH_URL}/emails?token=${token}`, {});
  }

  changeEmail(token: string): Observable<any> {
    return this.http.post(`${AppConstants.VERIFICATION_AUTH_URL}/emails/change?token=${token}`, {});
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
    return this.http.post(`${AppConstants.VERIFICATION_AUTH_URL}/passwords`, {
      token,
      newPassword
    });
  }

  validateResetPasswordToken(token: string): Observable<boolean> {
    return this.http.get<boolean>(`${AppConstants.VERIFICATION_AUTH_URL}/passwords/tokens`, {
        params: {token},
      }
    );
  }

  forgotPassword(email: string): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/forgot-password`;
    return this.http.post(url, {email});
  }

  refreshToken(): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/refresh-token`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  public logout(): Observable<any> {
    const url = `${AppConstants.AUTH_URL}/logout`;
    return this.http.post(url, {}, {withCredentials: true}).pipe(
      tap(() => {
        this.popupTemplateStateService.close(); // whatever is opened, on logout it should disappear
        this.localStorageService.clearUserRelatedData();
        this.userInfoService.clearUserInfo();
      })
    );
  }

  logoutPublic(): Observable<void> {
    return this.http.post<void>(`${AppConstants.PUBLIC_AUTH_URL}/logout`, {}, {withCredentials: true});
  }
}
