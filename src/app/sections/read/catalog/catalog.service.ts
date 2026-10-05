import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../../app.constants';
import {CatalogHit, parseCatalogHits} from './catalog.model';

/** Every notable book, metadata only: what search lands on when the shelf does not have it. */
@Injectable({providedIn: 'root'})
export class CatalogService {
  private http = inject(HttpClient);

  /** Open to guests; the state of each hit depends on the reader's country, which the server reads from the address. */
  search(query: string, limit = 20): Observable<CatalogHit[]> {
    const params = new HttpParams().set('q', query).set('limit', String(limit));
    return this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/catalog/search`, {params}).pipe(map(parseCatalogHits));
  }
}
