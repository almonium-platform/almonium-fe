import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from "../../app.constants";

@Injectable({
  providedIn: 'root',
})
export class DiscoverService {
  private http = inject(HttpClient);

  search(text: string): Observable<unknown> {
    const url = `${AppConstants.PUBLIC_AUTH_URL}/discover/freq/EN/?text=${encodeURIComponent(text)}`;
    return this.http.get(url);
  }
}
