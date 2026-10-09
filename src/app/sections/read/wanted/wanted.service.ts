import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../../app.constants';
import {LanguageCode} from '../../../models/language.enum';
import {WantReceipt, WantedQueue, parseWantReceipt, parseWantedQueue} from './wanted.model';

/**
 * Wanting a book (W1–W4): a catalogue work in the language the reader would read it in. Free and unmetered; it
 * buys a place in one public queue, nothing more.
 */
@Injectable({providedIn: 'root'})
export class WantedService {
  private http = inject(HttpClient);

  /** Idempotent. 409 when the work is under copyright or already on the shelf in that language. */
  want(catalogWorkId: string, language: LanguageCode): Observable<WantReceipt> {
    return this.http.post<unknown>(`${AppConstants.BOOKS_URL}/wants`, {catalogWorkId, language}, {withCredentials: true})
      .pipe(map(parseWantReceipt));
  }

  /** Takes a want back, silently. */
  withdraw(catalogWorkId: string, language: LanguageCode): Observable<unknown> {
    return this.http.delete(`${AppConstants.BOOKS_URL}/wants/${catalogWorkId}/${language}`, {withCredentials: true});
  }

  /** The Wanted page: everyone's queue, or only the rows the reader wants. */
  queue(mine = false): Observable<WantedQueue> {
    const params = new HttpParams().set('mine', String(mine));
    return this.http.get<unknown>(`${AppConstants.BOOKS_URL}/wanted`, {params, withCredentials: true})
      .pipe(map(parseWantedQueue));
  }
}
