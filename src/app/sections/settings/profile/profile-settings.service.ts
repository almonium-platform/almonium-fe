import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable, of} from "rxjs";
import {AppConstants} from "../../../app.constants";
import {ResponseModel} from "../../../models/response.model";
import {catchError, map} from "rxjs/operators";

@Injectable({
  providedIn: 'root',
})
export class ProfileSettingsService {
  constructor(private http: HttpClient) {
  }

  updateAvatarUrl(avatar: string): Observable<any> {
    const url = `${AppConstants.PROFILE_URL}/avatar`;
    return this.http.patch<ResponseModel>(url, {
      url: avatar
    }, {withCredentials: true}).pipe(
      catchError((error) => {
        console.error('Error updating avatar URL:', error);
        return of([]);
      })
    );
  }
}
