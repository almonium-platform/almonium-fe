import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {AppConstants} from "../../app.constants";
import {Book} from "./book.model";
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

  getBooksForLang(language: string): Observable<Book[]> {
    const url = `${AppConstants.BOOKS_URL}/language/${language}`;
    return this.http.get<Book[]>(url, {withCredentials: true});
  }

  deleteProgress(id: string, lang: LanguageCode): Observable<any> {
    const url = `${AppConstants.BOOKS_URL}/language/${lang}/${id}/progress`;
    return this.http.delete(url, {withCredentials: true});
  }
}
