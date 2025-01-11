import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';
import {LanguageCode} from "../models/language.enum";
import {TargetLanguageWithProficiency} from "../onboarding/language-setup/language-setup.model";
import {Learner} from "../models/userinfo.model";

@Injectable({
  providedIn: 'root',
})
export class LanguageApiService {
  constructor(private http: HttpClient) {
  }

  saveFluentLanguages(payload: { langCodes: string[] }): Observable<any> {
    const url = `${AppConstants.MY_LANGUAGES_URL}/fluent`;
    return this.http.put(url, payload, {withCredentials: true});
  }

  deleteLearner(currentTargetLanguage: LanguageCode) {
    const url = `${AppConstants.LEARNER_PROFILES_URL}/${currentTargetLanguage}`;
    return this.http.delete(url, {withCredentials: true});
  }

  setupLanguages(payload: TargetLanguageWithProficiency[]): Observable<Learner[]> {
    const url = `${AppConstants.LEARNER_PROFILES_URL}`;
    return this.http.post<Learner[]>(url, {data: payload}, {withCredentials: true});
  }

  updateLearner(language: LanguageCode, updates: Partial<{ active: boolean; level: string }>) {
    const url = `${AppConstants.LEARNER_PROFILES_URL}/${language}`;
    return this.http.patch(url, updates, {withCredentials: true});
  }
}
