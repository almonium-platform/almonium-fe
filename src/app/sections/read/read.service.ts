import {Injectable} from "@angular/core";
import {HttpClient, HttpParams} from "@angular/common/http";
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

  deleteProgress(id: string, lang: LanguageCode): Observable<any> {
    const url = `${AppConstants.BOOKS_URL}/language/${lang}/${id}/progress`;
    return this.http.delete(url, {withCredentials: true});
  }
}
