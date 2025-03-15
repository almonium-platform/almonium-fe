import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {UserProfileInfo} from "./user-profile.model";
import {AppConstants} from "../../app.constants";

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  constructor(private http: HttpClient) {
  }

  getUserProfile(userId: string): Observable<UserProfileInfo> {
    const url = `${AppConstants.PROFILE_URL}/${userId}`;
    return this.http.get<UserProfileInfo>(url, {withCredentials: true});
  }

  getUserPublicProfileById(id: string): Observable<UserProfileInfo> {
    const url = `${AppConstants.PUBLIC_PROFILE_URL}/${id}`;
    return this.http.get<UserProfileInfo>(url);
  }

  getUserPublicProfileByUsername(username: string): Observable<UserProfileInfo> {
    const url = `${AppConstants.PUBLIC_PROFILE_URL}/username/${username}`;
    return this.http.get<UserProfileInfo>(url);
  }
}
