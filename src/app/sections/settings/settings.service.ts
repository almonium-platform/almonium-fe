import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {AppConstants} from "../../app.constants";
import {Observable} from "rxjs";


@Injectable({
  providedIn: 'root',
})
export class SettingService {
  constructor(private http: HttpClient) {
  }

  deleteAccount(): Observable<any> {
    const url = `${AppConstants.USERS_URL}/me`;
    return this.http.delete(url, {withCredentials: true});
  }
}
