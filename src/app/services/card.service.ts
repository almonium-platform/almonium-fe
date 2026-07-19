import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {LanguageCode} from "../models/language.enum";
import {AppConstants} from "../app.constants";
import {CardDto} from "../models/card.model";


@Injectable({
  providedIn: 'root',
})
export class CardService {
  private http = inject(HttpClient);


  getCardsInLanguage(language: LanguageCode): Observable<CardDto[]> {
    return this.http.get<CardDto[]>(`${AppConstants.CARDS_IN_LANG}/${language}`, {withCredentials: true}).pipe(
      catchError((error) => {
        console.error('Error fetching cards:', error);
        return of([]);
      })
    );
  }
}
