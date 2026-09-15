import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {BehaviorSubject, Observable, map, tap} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {LanguageCode} from '../../models/language.enum';
import {LanguageRhythm, Rhythm, WeeklyTarget, hasTarget, localDate, parseRhythm} from './rhythm.model';

/**
 * The harness: the bar a learner sets for one language and whether they cleared it.
 *
 * <p>One loaded rhythm is shared by home, settings and the profile record so a target can never disagree with
 * itself across surfaces.
 */
@Injectable({providedIn: 'root'})
export class RhythmService {
  private readonly http = inject(HttpClient);
  private readonly rhythmSubject$ = new BehaviorSubject<Rhythm | null>(null);
  readonly rhythm$ = this.rhythmSubject$.asObservable();

  get rhythm(): Rhythm | null {
    return this.rhythmSubject$.value;
  }

  load(): Observable<Rhythm> {
    return this.http.get<unknown>(`${AppConstants.LEARNING_URL}/rhythm`, {
      params: {today: localDate()},
      withCredentials: true,
    }).pipe(
      map(parseRhythm),
      tap(rhythm => this.rhythmSubject$.next(rhythm)),
    );
  }

  setTarget(language: LanguageCode, target: WeeklyTarget): Observable<void> {
    return this.http.put<void>(`${AppConstants.LEARNING_URL}/rhythm/target`, {language, target}, {withCredentials: true})
      .pipe(tap(() => this.applyTarget(language, target)));
  }

  static forLanguage(rhythm: Rhythm | null, language: LanguageCode | null): LanguageRhythm | null {
    if (!rhythm || !language) return null;
    return rhythm.languages.find(entry => entry.language === language) ?? null;
  }

  /** Moving one language's bar re-judges its weeks against it; the days themselves are untouched. */
  private applyTarget(language: LanguageCode, target: WeeklyTarget): void {
    const current = this.rhythmSubject$.value;
    if (!current) return;
    this.rhythmSubject$.next({
      languages: current.languages.map(entry => entry.language !== language ? entry : {
        ...entry,
        target,
        weeks: entry.weeks.map(week => ({...week, met: hasTarget(target) && week.daysMet >= target})),
      }),
    });
  }
}
