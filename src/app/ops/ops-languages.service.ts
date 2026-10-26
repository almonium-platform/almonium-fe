import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

/** A word the lexicon could not answer, by lookups and by distinct people looking. */
export interface LanguageMiss {
  query: string;
  lookups: number;
  searchers: number;
}

/**
 * One language. Learners hold it as an active language; "seen" ones made a signed-in request in the window, in any
 * language. Searchers are distinct people who opened a Discover word sheet, signed in or not.
 */
export interface LanguageLine {
  language: string;
  learners: number;
  learnersSeenToday: number;
  learnersSeen: number;
  lookupsToday: number;
  lookups: number;
  searchers: number;
  answeredByLexicon: number;
  lemmas: number;
  topMisses: LanguageMiss[];
}

export interface LanguagePulse {
  generatedAt: string;
  days: number;
  since: string;
  languages: LanguageLine[];
}

/** /ops → Languages: which language's lexicon to warm up next. */
@Injectable({providedIn: 'root'})
export class OpsLanguagesService {
  private http = inject(HttpClient);

  pulse(days: number): Observable<LanguagePulse> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<LanguagePulse>(`${AppConstants.OPS_URL}/stats/languages`, {params, withCredentials: true});
  }
}

/** Share of lookups the lexicon answered, as a whole percent; null with nothing looked up. */
export function lexiconShare(line: Pick<LanguageLine, 'lookups' | 'answeredByLexicon'>): number | null {
  return line.lookups ? Math.round(100 * line.answeredByLexicon / line.lookups) : null;
}
