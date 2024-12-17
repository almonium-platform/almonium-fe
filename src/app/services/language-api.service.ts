import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';
import {LanguageCode} from "../models/language.enum";

@Injectable({
  providedIn: 'root',
})
export class LanguageApiService {
  constructor(private http: HttpClient) {
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

  addTargetLang(targetLang: LanguageCode) {
    const url = `${AppConstants.MY_LANGUAGES_URL}/target/${targetLang}`;
    return this.http.post(url, {}, {withCredentials: true});
  }
}
