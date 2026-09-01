import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map, Observable} from 'rxjs';
import {AppConstants} from '../app.constants';
import {LanguageCode} from "../models/language.enum";
import {TargetLanguageWithProficiency} from "../onboarding/language-setup/language-setup.model";
import {CEFRLevel, Learner} from "../models/userinfo.model";
import {ActiveLanguagePolicy, parseActiveLanguagePolicy} from "../models/active-language-policy.model";

@Injectable({
  providedIn: 'root',
})
export class LanguageApiService {
  private http = inject(HttpClient);


  saveFluentLanguages(payload: { langCodes: string[] }): Observable<unknown> {
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

  /** What the account may do with its languages: how many stay active, and when the next switch is available. */
  getActiveLanguagePolicy(): Observable<ActiveLanguagePolicy> {
    const url = `${AppConstants.LEARNER_PROFILES_URL}/active-language-policy`;
    return this.http.get<unknown>(url, {withCredentials: true}).pipe(map(parseActiveLanguagePolicy));
  }

  /** Records which language survives the downgrade. Nothing changes until the plan actually ends. */
  keepOnDowngrade(language: LanguageCode): Observable<ActiveLanguagePolicy> {
    const url = `${AppConstants.LEARNER_PROFILES_URL}/keep-on-downgrade`;
    return this.http.put<unknown>(url, {language}, {withCredentials: true}).pipe(map(parseActiveLanguagePolicy));
  }

  updateLearner(language: LanguageCode, updates: Partial<{ active: boolean; level: CEFRLevel }>): Observable<Learner | null> {
    const url = `${AppConstants.LEARNER_PROFILES_URL}/${language}`;
    return this.http.patch<unknown>(url, updates, {withCredentials: true}).pipe(
      map((response) => response === null ? null : Learner.fromJSON(response)),
    );
  }
}
