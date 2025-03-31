import {Injectable} from "@angular/core";
import {HttpClient, HttpParams, HttpResponse} from "@angular/common/http";
import {AppConstants} from "../../app.constants";
import {Book, BookshelfView} from "./book.model";
import {Observable} from "rxjs";
import {LanguageCode} from "../../models/language.enum";

@Injectable({
  providedIn: 'root',
})
export class ReadService {
  constructor(private http: HttpClient) {
  }

  getBooks(): Observable<Book[]> {
    const url = `${AppConstants.PUBLIC_BOOKS_URL}`;
    return this.http.get<Book[]>(url, {withCredentials: true});
  }

  getBooksForLang(language: string, includeTranslations: boolean): Observable<BookshelfView> {
    const url = `${AppConstants.BOOKS_URL}/language/${language}`;
    const params = new HttpParams().set('includeTranslations', includeTranslations.toString());
    return this.http.get<BookshelfView>(url, {params, withCredentials: true});
  }

  getBooksById(bookId: number, language: string): Observable<Book> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}`;
    return this.http.get<Book>(url, {withCredentials: true});
  }

  orderTranslation(bookId: number, language: string): Observable<any> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/orders`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  cancelTranslationOrder(bookId: number, language: string): Observable<any> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/orders`;
    return this.http.delete(url, {withCredentials: true});
  }

  favoriteBook(bookId: number, language: string): Observable<any> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/favorite`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  unfavoriteBook(bookId: number, language: string): Observable<any> {
    const url = `${AppConstants.BOOKS_URL}/${bookId}/language/${language}/favorite`;
    return this.http.delete(url, {withCredentials: true});
  }

  deleteProgress(id: number, lang: LanguageCode): Observable<any> {
    const url = `${AppConstants.BOOKS_URL}/language/${lang}/${id}/progress`;
    return this.http.delete(url, {withCredentials: true});
  }

  loadBook(number: number): Observable<HttpResponse<ArrayBuffer>> {
    const url = `${AppConstants.BOOKS_URL}/${number}`;
    return this.http.get(url, {
      withCredentials: true,
      responseType: 'arraybuffer',
      observe: 'response'
    });
  }
}
