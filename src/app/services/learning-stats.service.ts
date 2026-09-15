import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {Observable, map} from 'rxjs';
import {AppConstants} from '../app.constants';
import {LanguageCode} from '../models/language.enum';
import {expectNumber, expectRecord} from '../shared/runtime-validation';

/** The profile numbers that only move by reading. */
export interface LearningStats {
  wordsKept: number;
  booksFinished: number;
}

export function parseLearningStats(value: unknown): LearningStats {
  const stats = expectRecord(value, 'learning stats');
  return {
    wordsKept: expectNumber(stats['wordsKept'], 'learning stats.wordsKept'),
    booksFinished: expectNumber(stats['booksFinished'], 'learning stats.booksFinished'),
  };
}

@Injectable({providedIn: 'root'})
export class LearningStatsService {
  private readonly http = inject(HttpClient);

  getStats(language: LanguageCode): Observable<LearningStats> {
    return this.http.get<unknown>(`${AppConstants.LEARNING_URL}/stats/${language}`, {withCredentials: true})
      .pipe(map(parseLearningStats));
  }
}
