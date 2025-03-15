import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {PublicUserProfile, RelatedUserProfile} from "./social.model";
import {AppConstants} from "../../app.constants";
import {UserProfileInfo} from "../../shared/user-preview-card/user-profile.model";

@Injectable({
  providedIn: 'root',
})
export class SocialService {
  constructor(
    private http: HttpClient,
  ) {
  }

  getFriends(): Observable<RelatedUserProfile[]> {
    return this.http.get<RelatedUserProfile[]>(`${AppConstants.RELATIONSHIPS_URL}`, {withCredentials: true});
  }

  getOutgoingRequests(): Observable<RelatedUserProfile[]> {
    return this.http.get<RelatedUserProfile[]>(`${AppConstants.RELATIONSHIPS_URL}/requests/sent`, {withCredentials: true});
  }

  getIncomingRequests(): Observable<RelatedUserProfile[]> {
    return this.http.get<RelatedUserProfile[]>(`${AppConstants.RELATIONSHIPS_URL}/requests/received`, {withCredentials: true});
  }

  searchAllByUsername(username: string): Observable<PublicUserProfile[]> {
    return this.http.get<PublicUserProfile[]>(
      `${AppConstants.RELATIONSHIPS_URL}/search/all?username=${username}`,
      {withCredentials: true}
    );
  }

  // TODO: Remove this method
  searchFriendsByUsername(username: string): Observable<RelatedUserProfile[]> {
    return this.http.get<RelatedUserProfile[]>(
      `${AppConstants.RELATIONSHIPS_URL}/search/friends?username=${username}`,
      {withCredentials: true}
    );
  }

  block(id: string): Observable<UserProfileInfo> {
    return this.http.post<UserProfileInfo>(`${AppConstants.RELATIONSHIPS_URL}/block/${id}`, {}, {withCredentials: true});
  }

  createFriendshipRequest(recipientId: string): Observable<UserProfileInfo> {
    return this.http.post<UserProfileInfo>(
      `${AppConstants.RELATIONSHIPS_URL}`,
      {recipientId},
      {withCredentials: true});
  }

  patchFriendship(id: string, action: string): Observable<UserProfileInfo> {
    return this.http.patch<UserProfileInfo>(
      `${AppConstants.RELATIONSHIPS_URL}/${id}`,
      {action},
      {withCredentials: true});
  }

  getBlocked(): Observable<RelatedUserProfile[]> {
    return this.http.get<RelatedUserProfile[]>(`${AppConstants.RELATIONSHIPS_URL}/blocked`, {withCredentials: true});
  }
}
