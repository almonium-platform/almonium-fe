import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Language} from '../../models/language.model';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../app.constants';
import {LanguageNameService} from "../../services/language-name.service";

@Injectable({
  providedIn: 'root',
})
export class LanguageSetupService {
  private apiUrl = '/supported-langs';
  private userLangsUrl = '/users/me/langs';

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
    const url = `${AppConstants.API_URL}${this.userLangsUrl}`;
    return this.http.put(url, payload, {withCredentials: true});
  }

  saveFluentLanguages(payload: { fluentLangs: string[] }): Observable<any> {
    const url = `${AppConstants.API_URL}${this.userLangsUrl}`;
    return this.http.put(url, payload, {withCredentials: true});
  }
}
