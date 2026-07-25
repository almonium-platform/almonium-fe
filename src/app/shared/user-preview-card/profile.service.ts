import { Injectable, inject } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {map} from 'rxjs/operators';
import {parseUserProfileInfo, UserProfileInfo} from "./user-profile.model";
import {AppConstants} from "../../app.constants";

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private http = inject(HttpClient);


  getUserProfile(userId: string): Observable<UserProfileInfo> {
    const url = `${AppConstants.PROFILE_URL}/${userId}`;
    return this.http.get<unknown>(url, {withCredentials: true}).pipe(map(parseUserProfileInfo));
  }

  getUserPublicProfileById(id: string): Observable<UserProfileInfo> {
    const url = `${AppConstants.PUBLIC_PROFILE_URL}/${id}`;
    return this.http.get<unknown>(url).pipe(map(parseUserProfileInfo));
  }

  getUserPublicProfileByUsername(username: string): Observable<UserProfileInfo> {
    const url = `${AppConstants.PUBLIC_PROFILE_URL}/username/${username}`;
    return this.http.get<unknown>(url).pipe(map(parseUserProfileInfo));
  }
}
