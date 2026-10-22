import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../../app.constants';
import {LanguageCode} from '../../../models/language.enum';
import {CatalogHit, WorkUnlocks, parseCatalogHits, parseWorkUnlocks} from './catalog.model';

/** Every notable book, metadata only: what search lands on when the shelf does not have it. */
@Injectable({providedIn: 'root'})
export class CatalogService {
  private http = inject(HttpClient);

  /**
   * Open to guests; the state of each hit depends on the reader's country, which the server reads from the address.
   * With a language, each hit also says how many want it in that language and, for a member (the session cookie
   * goes along), whether they do.
   */
  search(query: string, limit = 20, language: LanguageCode | null = null): Observable<CatalogHit[]> {
    let params = new HttpParams().set('q', query).set('limit', String(limit));
    if (language) params = params.set('language', language);
    return this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/catalog/search`, {params, withCredentials: true})
      .pipe(map(parseCatalogHits));
  }

  /**
   * Public Domain Day: the best-known works that become free on 1 January of `year` (next year by the server's
   * calendar when null), as search hits, so readers and the viewer's own want come along with a language.
   */
  comingFree(year: number | null = null, limit = 12, language: LanguageCode | null = null): Observable<CatalogHit[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (year !== null) params = params.set('year', String(year));
    if (language) params = params.set('language', language);
    return this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/catalog/coming-free`, {params, withCredentials: true})
      .pipe(map(parseCatalogHits));
  }

  /** Where and when one work is free to read, country by country: the unlock map (W7). Open to guests. */
  unlocks(catalogWorkId: string): Observable<WorkUnlocks> {
    return this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/catalog/works/${catalogWorkId}/unlocks`, {withCredentials: true})
      .pipe(map(parseWorkUnlocks));
  }
}
