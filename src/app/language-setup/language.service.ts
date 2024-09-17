import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Language} from './language.model';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../app.constants';
import iso6391 from 'iso-639-1';
import {iso6393} from "iso-639-3";

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private apiUrl = '/supported-langs';
  private userLangsUrl = '/users/me/langs';

  constructor(private http: HttpClient) {
  }

  // Method to get languages from the backend
  getLanguages(): Observable<Language[]> {
    const url = `${AppConstants.PUBLIC_URL}${this.apiUrl}`;
    return this.http.get<string[]>(url).pipe(
      map((languageCodes) => {
        return languageCodes.map((code) => {
          let name: string | undefined;

          // First, try iso-639-1 (for two-letter codes)
          if (code.length === 2) {
            name = iso6391.getName(code.toLowerCase());
          }

          // If not found or code is longer, try iso-639-3 (for three-letter codes)
          if (!name && code.length === 3) {
            const language = iso6393.find((lang) => lang.iso6393 === code.toLowerCase());
            name = language ? language.name : undefined;
          }

          return {
            code: code.toLowerCase(),
            name: name || code.toUpperCase(), // Fallback to showing the code if no name is found
          };
        });
      })
    );
  }

  saveUserLanguages(payload: { fluentLangs: string[]; targetLangs: string[] }): Observable<any> {
    const url = `${AppConstants.API_URL}${this.userLangsUrl}`;
    return this.http.put(url, payload, {withCredentials: true});
  }
}
