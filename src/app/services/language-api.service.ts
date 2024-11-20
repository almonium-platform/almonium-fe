import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Language} from '../models/language.model';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../app.constants';
import {LanguageNameService} from "./language-name.service";
import {LanguageCode} from "../models/language.enum";

@Injectable({
  providedIn: 'root',
})
export class LanguageApiService {
  private apiUrl = '/supported-langs';

  constructor(private http: HttpClient,
              private languageNameService: LanguageNameService
  ) {
  }

  // Method to get languages from the backend - TODO rename for clarity
  getLanguages(): Observable<Language[]> {
    const url = `${AppConstants.PUBLIC_URL}${this.apiUrl}`;
    return this.http.get<string[]>(url).pipe(
      map((languageCodes) => {
        return languageCodes.map((code) => {
          return {
            code: code.toLowerCase(),
            name: this.languageNameService.getLanguageName(code),
          };
        });
      })
    );
  }

  saveUserLanguages(payload: { fluentLangs: string[]; targetLangs: string[] }): Observable<any> {
    const url = `${AppConstants.MY_LANGUAGES_URL}`;
    return this.http.put(url, payload, {withCredentials: true});
  }

  saveFluentLanguages(payload: { langCodes: string[] }): Observable<any> {
    const url = `${AppConstants.MY_LANGUAGES_URL}/fluent`;
    return this.http.put(url, payload, {withCredentials: true});
  }

  deleteTargetLang(currentTargetLanguage: LanguageCode) {
    const url = `${AppConstants.MY_LANGUAGES_URL}/target/${currentTargetLanguage}`;
    return this.http.delete(url, {withCredentials: true});
  }

  addTargetLang(targetLang: string) {
    const url = `${AppConstants.MY_LANGUAGES_URL}/target/${targetLang}`;
    return this.http.put(url, {}, {withCredentials: true});
  }
}
