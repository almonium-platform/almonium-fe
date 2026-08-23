import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, map} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {
  ReviewAnswer,
  ReviewSession,
  ReviewSessionResult,
  ReviewSummary,
  parseReviewAnswer,
  parseReviewSession,
  parseReviewSessionResult,
  parseReviewSummary,
} from './review.model';

@Injectable({providedIn: 'root'})
export class ReviewService {
  private readonly http = inject(HttpClient);

  getSummary(language: LanguageCode): Observable<ReviewSummary> {
    return this.http.get<unknown>(`${AppConstants.REVIEW_URL}/summary/${language}`, {withCredentials: true})
      .pipe(map(parseReviewSummary));
  }

  startSession(language: LanguageCode): Observable<ReviewSession> {
    return this.http.post<unknown>(`${AppConstants.REVIEW_URL}/sessions/${language}`, {}, {withCredentials: true})
      .pipe(map(parseReviewSession));
  }

  answer(
    sessionId: string,
    itemId: string,
    promptId: string,
    answer: string,
    hintsOpened: string[],
    revealed: boolean,
  ): Observable<ReviewAnswer> {
    return this.http.post<unknown>(
      `${AppConstants.REVIEW_URL}/sessions/${sessionId}/items/${itemId}/answer`,
      {promptId, answer, hintsOpened, revealed},
      {withCredentials: true},
    ).pipe(map(parseReviewAnswer));
  }

  getResult(sessionId: string): Observable<ReviewSessionResult> {
    return this.http.get<unknown>(`${AppConstants.REVIEW_URL}/sessions/${sessionId}/result`, {withCredentials: true})
      .pipe(map(parseReviewSessionResult));
  }

  markMistype(eventId: string): Observable<void> {
    return this.http.post<void>(`${AppConstants.REVIEW_URL}/events/${eventId}/mistype`, {}, {withCredentials: true});
  }

  reencounter(itemId: string): Observable<void> {
    return this.http.post<void>(`${AppConstants.REVIEW_URL}/leeches/${itemId}/reencounter`, {}, {withCredentials: true});
  }
}
