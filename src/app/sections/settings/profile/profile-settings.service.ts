import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {AppConstants} from "../../../app.constants";
import {Avatar} from "./avatar/avatar.model";

@Injectable({
  providedIn: 'root',
})
export class ProfileSettingsService {
  constructor(private http: HttpClient) {
  }

  /**
   * Get all avatars for the current user
   */
  getAvatars(): Observable<Avatar[]> {
    const url = `${AppConstants.AVATARS_URL}`;
    return this.http.get<Avatar[]>(url, {withCredentials: true});
  }

  /**
   * Add and set a new avatar for the current user
   * @param avatarUrl of the new avatar
   */
  addAndSetNewAvatar(avatarUrl: string): Observable<any> {
    const url = `${AppConstants.AVATARS_URL}`;
    return this.http.post(url, {avatarUrl}, {withCredentials: true});
  }

  /**
   * Choose another existing custom avatar as the active one
   * @param avatarId ID of the avatar to be set as active
   */
  chooseExistingCustomAvatar(avatarId: number): Observable<any> {
    const url = `${AppConstants.AVATARS_URL}/${avatarId}`;
    return this.http.patch(url, {}, {withCredentials: true});
  }

  /**
   * Choose a default avatar for the current user
   * @param avatarUrl URL of the default avatar to be set
   */
  chooseDefaultAvatar(avatarUrl: string): Observable<any> {
    const url = `${AppConstants.AVATARS_URL}/default`;
    return this.http.patch(url, {avatarUrl}, {withCredentials: true});
  }

  /**
   * Delete an avatar by its ID
   * @param avatarId ID of the avatar to delete
   */
  deleteCustomAvatar(avatarId: number): Observable<any> {
    const url = `${AppConstants.AVATARS_URL}/${avatarId}`;
    return this.http.delete(url, {withCredentials: true});
  }

  /**
   * Reset current user's avatar to the default one
   */
  resetAvatar(): Observable<any> {
    const url = `${AppConstants.AVATARS_URL}/current`;
    return this.http.patch(url, {}, {withCredentials: true});
  }

  // usernames
  updateUsername(username: string): Observable<any> {
    const url = `${AppConstants.ME_URL}/username`;
    return this.http.patch(url, {username}, {withCredentials: true});
  }

  checkUsernameAvailability(username: string): Observable<{ available: boolean }> {
    const url = `${AppConstants.USERS_URL}/${username}/availability`;
    return this.http.get<{ available: boolean }>(url, {withCredentials: true});
  }

  // interests
  saveInterests(ids: number[]): Observable<any> {
    const url = `${AppConstants.ME_URL}/interests`;
    return this.http.patch(url, {ids}, {withCredentials: true});
  }
}
