import {Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Language} from "../../../models/language.enum";

@Injectable({
  providedIn: 'root',
})
export class AutocompleteService {
  constructor(private http: HttpClient) {
  }

  getAutocompleteSuggestions(searchText: string, language: Language): Observable<string[]> {
    if (language !== Language.EN || searchText.length < 3) {
      return of([]);
    }

    const apiUrl = `https://api.datamuse.com/sug?k=demo&s=${searchText}&max=5`;
    return this.http.get<{ word: string }[]>(apiUrl).pipe(
      map((data: { word: string }[]) => data.map(item => item.word).slice(0, 5)),
      catchError(() => of([]))
    );
  }
}
