import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {Friend, Friendship, RelatedUserPublicProfile, UserPublicProfile} from "./social.model";
import {AppConstants} from "../../app.constants";

@Injectable({
  providedIn: 'root',
})
export class SocialService {
  constructor(
    private http: HttpClient,
  ) {
  }

  fetchFriends(): Observable<Friend[]> {
    return this.http.get<Friend[]>(`${AppConstants.FRIENDSHIPS_URL}`, {withCredentials: true});
  }

  getOutgoingRequests(): Observable<RelatedUserPublicProfile[]> {
    return this.http.get<RelatedUserPublicProfile[]>(`${AppConstants.FRIENDSHIPS_URL}/requests/sent`, {withCredentials: true});
  }

  getIncomingRequests(): Observable<RelatedUserPublicProfile[]> {
    return this.http.get<RelatedUserPublicProfile[]>(`${AppConstants.FRIENDSHIPS_URL}/requests/received`, {withCredentials: true});
  }

  searchAllByUsername(username: string): Observable<UserPublicProfile[]> {
    return this.http.get<UserPublicProfile[]>(
      `${AppConstants.FRIENDSHIPS_URL}/search/all?username=${username}`,
      {withCredentials: true}
    );
  }

  searchFriendsByUsername(username: string): Observable<RelatedUserPublicProfile[]> {
    return this.http.get<RelatedUserPublicProfile[]>(
      `${AppConstants.FRIENDSHIPS_URL}/search/friends?username=${username}`,
      {withCredentials: true}
    );
  }

  createFriendshipRequest(recipientId: number): Observable<Friendship> {
    return this.http.post<Friendship>(
      `${AppConstants.FRIENDSHIPS_URL}`,
      {recipientId},
      {withCredentials: true});
  }

  patchFriendship(id: number, action: string): Observable<UserPublicProfile> {
    return this.http.patch<UserPublicProfile>(
      `${AppConstants.FRIENDSHIPS_URL}/${id}`,
      {action},
      {withCredentials: true});
  }
}
