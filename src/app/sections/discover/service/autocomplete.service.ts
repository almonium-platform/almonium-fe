import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {LanguageCode} from "../../../models/language.enum";
import {expectArray, expectRecord, expectString} from '../../../shared/runtime-validation';

@Injectable({
  providedIn: 'root',
})
export class AutocompleteService {
  private http = inject(HttpClient);


  getAutocompleteSuggestions(searchText: string, language: LanguageCode): Observable<string[]> {
    if (language !== LanguageCode.EN || searchText.length < 3) {
      return of([]);
    }

    const apiUrl = `https://api.datamuse.com/sug?k=demo&s=${searchText}&max=5`;
    return this.http.get<unknown>(apiUrl).pipe(
      map(data => expectArray(data, 'autocomplete')
        .map((item, index) => {
          const suggestion = expectRecord(item, `autocomplete[${index}]`);
          return expectString(suggestion['word'], `autocomplete[${index}].word`);
        })
        .slice(0, 5)),
      catchError(() => of([]))
    );
  }
}
