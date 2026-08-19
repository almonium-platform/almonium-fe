import { Injectable, inject } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {AppConstants} from "../../../app.constants";
import {UIPreferences} from "../../../models/userinfo.model";

@Injectable({
  providedIn: 'root',
})
export class ProfileSettingsService {
  private http = inject(HttpClient);


  /**
   * Choose a default avatar for the current user
   * @param avatarUrl URL of the default avatar to be set
   */
  chooseDefaultAvatar(avatarUrl: string): Observable<unknown> {
    const url = `${AppConstants.AVATARS_URL}/default`;
    return this.http.patch(url, {avatarUrl}, {withCredentials: true});
  }

  /**
   * Reset current user's avatar to the default one
   */
  resetAvatar(): Observable<unknown> {
    const url = `${AppConstants.AVATARS_URL}/current`;
    return this.http.patch(url, {}, {withCredentials: true});
  }

  // usernames
  updateUsername(username: string): Observable<unknown> {
    const url = `${AppConstants.ME_URL}/username`;
    return this.http.patch(url, {username}, {withCredentials: true});
  }

  checkUsernameAvailability(username: string): Observable<{ available: boolean }> {
    const url = `${AppConstants.USERS_URL}/${username}/availability`;
    return this.http.get<{ available: boolean }>(url, {withCredentials: true});
  }

  saveInterests(ids: number[]): Observable<unknown> {
    const url = `${AppConstants.ME_URL}/interests`;
    return this.http.patch(url, {ids}, {withCredentials: true});
  }

  saveUiPreferences(uiPreferences: UIPreferences): Observable<unknown> {
    const url = `${AppConstants.PROFILE_URL}/ui-preferences`;
    return this.http.patch(url, uiPreferences, {withCredentials: true});
  }

  toggleHidden(hidden: boolean): Observable<unknown> {
    const url = `${AppConstants.PROFILE_URL}/hidden`;
    return this.http.patch(url, {hidden}, {withCredentials: true});
  }
}
