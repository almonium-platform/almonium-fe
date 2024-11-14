import {Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from "../../app.constants";

@Injectable({
  providedIn: 'root',
})
export class DiscoverService {
  constructor(private http: HttpClient) {}

  search(text: string): Observable<any> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/discover/freq/EN/?text=${encodeURIComponent(text)}`;
    return this.http.get(url);
  }
}
