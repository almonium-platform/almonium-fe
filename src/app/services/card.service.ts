import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {LanguageCode} from "../models/language.enum";
import {AppConstants} from "../app.constants";
import {CardCreationDto, CardDto, parseCards} from "../models/card.model";


@Injectable({
  providedIn: 'root',
})
export class CardService {
  private http = inject(HttpClient);


  getCardsInLanguage(language: LanguageCode): Observable<CardDto[]> {
    return this.http.get<unknown>(`${AppConstants.CARDS_IN_LANG}/${language}`, {withCredentials: true})
      .pipe(map(parseCards));
  }

  createCard(dto: CardCreationDto): Observable<CardDto> {
    return this.http.post<unknown>(AppConstants.CARDS_URL, dto, {withCredentials: true})
      .pipe(map(value => parseCards([value])[0]));
  }
}
