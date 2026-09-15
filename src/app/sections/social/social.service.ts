import { Injectable, inject } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {map} from 'rxjs/operators';
import {
  parseRelatedUserProfiles,
  parseUserSearchResults,
  RelatedUserProfile,
  UserSearchResult,
} from "./social.model";
import {AppConstants} from "../../app.constants";
import {UserProfileInfo} from "../../shared/user-preview-card/user-profile.model";
import {parseUserProfileInfo} from '../../shared/user-preview-card/user-profile.model';

@Injectable({
  providedIn: 'root',
})
export class SocialService {
  private http = inject(HttpClient);


  getFriends(): Observable<RelatedUserProfile[]> {
    return this.http.get<unknown>(`${AppConstants.RELATIONSHIPS_URL}`, {withCredentials: true})
      .pipe(map(value => parseRelatedUserProfiles(value, 'friends')));
  }

  getOutgoingRequests(): Observable<RelatedUserProfile[]> {
    return this.http.get<unknown>(`${AppConstants.RELATIONSHIPS_URL}/requests/sent`, {withCredentials: true})
      .pipe(map(value => parseRelatedUserProfiles(value, 'outgoing requests')));
  }

  getIncomingRequests(): Observable<RelatedUserProfile[]> {
    return this.http.get<unknown>(`${AppConstants.RELATIONSHIPS_URL}/requests/received`, {withCredentials: true})
      .pipe(map(value => parseRelatedUserProfiles(value, 'incoming requests')));
  }

  searchAllByUsername(username: string): Observable<UserSearchResult[]> {
    return this.http.get<unknown>(
      `${AppConstants.RELATIONSHIPS_URL}/search/all?username=${encodeURIComponent(username)}`,
      {withCredentials: true}
    ).pipe(map(value => parseUserSearchResults(value)));
  }

  // TODO: Remove this method
  searchFriendsByUsername(username: string): Observable<RelatedUserProfile[]> {
    return this.http.get<unknown>(
      `${AppConstants.RELATIONSHIPS_URL}/search/friends?username=${encodeURIComponent(username)}`,
      {withCredentials: true}
    ).pipe(map(value => parseRelatedUserProfiles(value, 'friend search results')));
  }

  block(id: string): Observable<UserProfileInfo> {
    return this.http.post<unknown>(`${AppConstants.RELATIONSHIPS_URL}/block/${id}`, {}, {withCredentials: true})
      .pipe(map(parseUserProfileInfo));
  }

  createFriendshipRequest(recipientId: string): Observable<UserProfileInfo> {
    return this.http.post<unknown>(
      `${AppConstants.RELATIONSHIPS_URL}`,
      {recipientId},
      {withCredentials: true}).pipe(map(parseUserProfileInfo));
  }

  patchFriendship(id: string, action: string): Observable<UserProfileInfo> {
    return this.http.patch<unknown>(
      `${AppConstants.RELATIONSHIPS_URL}/${id}`,
      {action},
      {withCredentials: true}).pipe(map(parseUserProfileInfo));
  }

  getBlocked(): Observable<RelatedUserProfile[]> {
    return this.http.get<unknown>(`${AppConstants.RELATIONSHIPS_URL}/blocked`, {withCredentials: true})
      .pipe(map(value => parseRelatedUserProfiles(value, 'blocked users')));
  }
}
