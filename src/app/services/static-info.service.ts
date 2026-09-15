import { Injectable, inject } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable, shareReplay} from "rxjs";
import {AppConstants} from "../app.constants";
import {Interest} from "../shared/interests/interest.model";
import {expectArray, expectEnum} from '../shared/runtime-validation';
import {LanguageCode} from '../models/language.enum';
import {map} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class StaticInfoService {
  private http = inject(HttpClient);
  private readonly interests$ = this.http.get<Interest[]>(`${AppConstants.INFO_URL}/interests`).pipe(
    shareReplay({bufferSize: 1, refCount: false}),
  );


  getInterests(): Observable<Interest[]> {
    return this.interests$;
  }

  getSupportedLanguages(): Observable<string[]> {
    const url = `${AppConstants.INFO_URL}/languages/supported`;
    return this.http.get<unknown>(url).pipe(
      map(value => expectArray(value, 'supported languages').map((language, index) =>
        expectEnum(language, Object.values(LanguageCode), `supported languages[${index}]`),
      )),
    );
  }
}
