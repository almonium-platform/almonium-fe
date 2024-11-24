import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {LanguageCode} from "../../../models/language.enum";

@Injectable({
  providedIn: 'root',
})
export class AutocompleteService {
  constructor(private http: HttpClient) {
  }

  getAutocompleteSuggestions(searchText: string, language: LanguageCode): Observable<string[]> {
    if (language !== LanguageCode.EN || searchText.length < 3) {
      return of([]);
    }

    const apiUrl = `https://api.datamuse.com/sug?k=demo&s=${searchText}&max=5`;
    return this.http.get<{ word: string }[]>(apiUrl).pipe(
      map((data: { word: string }[]) => data.map(item => item.word).slice(0, 5)),
      catchError(() => of([]))
    );
  }
}
