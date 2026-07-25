import { Injectable, inject } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
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


  getInterests(): Observable<Interest[]> {
    const url = `${AppConstants.INFO_URL}/interests`;
    return this.http.get<Interest[]>(url);
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
