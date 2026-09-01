import { Injectable, inject } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {BehaviorSubject, Observable} from "rxjs";
import {map, tap} from 'rxjs/operators';
import {parseUserProfileInfo, UserProfileInfo} from "./user-profile.model";
import {AppConstants} from "../../app.constants";

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private http = inject(HttpClient);

  /**
   * The signed-in user's own profile, held past the lifetime of any one component: the settings tabs are separate
   * routes, and re-fetching on every switch left the header blank for as long as the request took.
   */
  private readonly myProfileSubject$ = new BehaviorSubject<UserProfileInfo | null>(null);
  readonly myProfile$ = this.myProfileSubject$.asObservable();

  /** Refreshes the cached own profile; subscribers keep the last one until the new one lands. */
  loadMyProfile(userId: string): Observable<UserProfileInfo> {
    if (this.myProfileSubject$.value?.id !== userId) {
      this.myProfileSubject$.next(null);
    }
    return this.getUserProfile(userId).pipe(tap(profile => this.myProfileSubject$.next(profile)));
  }

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
