import {logger} from "../../shared/logger";
import { Injectable, inject } from "@angular/core";
import {HttpClient, HttpParams, HttpResponse} from "@angular/common/http";
import {AppConstants} from "../../app.constants";
import {
  Book,
  BookMiniDetails,
  BookshelfView,
  parseBook,
  parseBookMiniDetails,
  parseBooks,
  parseBookshelfView,
} from "./book.model";
import {Observable} from "rxjs";
import {map, tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ReadService {
  private http = inject(HttpClient);


  // --- Existing Methods (Keep As Is) ---
  getBooks(): Observable<Book[]> {
    const url = `${AppConstants.PUBLIC_BOOKS_URL}`;
    return this.http.get<unknown>(url, {withCredentials: true}).pipe(map(parseBooks));
  }

  getBooksForLang(language: string, includeTranslations: boolean): Observable<BookshelfView> {
    const url = `${AppConstants.BOOKS_URL}/language/${language}`;
    const params = new HttpParams().set('includeTranslations', includeTranslations.toString());
    return this.http.get<unknown>(url, {params, withCredentials: true}).pipe(map(parseBookshelfView));
  }

  getParallelText(id1: number, language: string): Observable<HttpResponse<ArrayBuffer>> {
    const url = `${AppConstants.BOOKS_URL}/${id1}/parallel/${language}`;
    return this.http.get(url, {
      withCredentials: true,
      responseType: 'arraybuffer',
      observe: 'response'
    });
  }

  getBookById(bookId: number, language: string): Observable<Book> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}`;
    return this.http.get<unknown>(url, {withCredentials: true}).pipe(map(value => parseBook(value)));
  }

  getMiniBookDetailsById(bookId: number): Observable<BookMiniDetails> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}`;
    return this.http.get<unknown>(url, {withCredentials: true}).pipe(map(parseBookMiniDetails));
  }

  orderTranslation(bookId: number, language: string): Observable<unknown> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/orders`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  cancelTranslationOrder(bookId: number, language: string): Observable<unknown> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/orders`;
    return this.http.delete(url, {withCredentials: true});
  }

  favoriteBook(bookId: number, language: string): Observable<unknown> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/favorite`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  unfavoriteBook(bookId: number, language: string): Observable<unknown> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/favorite`;
    return this.http.delete(url, {withCredentials: true});
  }

  loadBook(bookId: number): Observable<HttpResponse<ArrayBuffer>> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/text`;
    return this.http.get(url, {
      withCredentials: true,
      responseType: 'arraybuffer',
      observe: 'response'
    });
  }

  // --- Progress Methods ---
  deleteProgress(bookId: number): Observable<void> { // Return void for clarity
    const url = `${AppConstants.BOOKS_URL}/${bookId}/progress`;
    return this.http.delete<void>(url, {withCredentials: true}).pipe(
      tap(() => logger.debug(`ReadService: Deleted progress for ${bookId}`)),
    );
  }

  /**
   * Saves progress using a standard HTTP POST request with query parameters.
   * Use for regular saves and ngOnDestroy.
   */
  saveProgress(bookId: number, percentage: number): Observable<void> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/progress`;
    percentage = Math.max(0, Math.min(100, Math.round(percentage)));
    const params = new HttpParams().set('percentage', percentage.toString());

    return this.http.post<void>(url, null, {params, withCredentials: true}).pipe(
      tap(() => logger.debug(`ReadService: Saved progress ${percentage}% for ${bookId}`)),
    );
  }

  /**
   * Saves progress using the Beacon API.
   * Use for 'beforeunload' event. Returns true if beacon was queued, false otherwise.
   */
  sendProgressBeacon(bookId: number, percentage: number): boolean {
    if (!navigator.sendBeacon) {
      logger.warn('ReadService: Beacon API not supported.');
      return false;
    }

    percentage = Math.max(0, Math.min(100, Math.round(percentage)));
    const url = `${AppConstants.BOOKS_URL}/${bookId}/progress?percentage=${percentage}`;

    try {
      const sent = navigator.sendBeacon(url);
      if (sent) {
        logger.debug(`ReadService: Sent Beacon progress ${percentage}% for $/${bookId}`);
      } else {
        logger.warn(`ReadService: Beacon API returned false for ${bookId}`);
      }
      return sent;
    } catch (e) {
      logger.error(`ReadService: Error sending beacon for ${bookId}`, e);
      return false;
    }
  }
}
