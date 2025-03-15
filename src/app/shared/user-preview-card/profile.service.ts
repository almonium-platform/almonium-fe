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
}
