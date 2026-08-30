import {HttpClient} from '@angular/common/http';
import {Injectable, inject} from '@angular/core';
import {BehaviorSubject, Observable, map, tap} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {Rhythm, WeeklyTarget, hasTarget, localDate, parseRhythm} from './rhythm.model';

/**
 * The harness: the learner's own weekly bar and whether they cleared it.
 *
 * <p>One loaded rhythm is shared by home, settings and the profile strip so the target can never disagree with
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

  setTarget(target: WeeklyTarget): Observable<void> {
    return this.http.put<void>(`${AppConstants.LEARNING_URL}/rhythm/target`, {target}, {withCredentials: true})
      .pipe(tap(() => this.applyTarget(target)));
  }

  /** Moving the bar re-judges the weeks against it; the days themselves are untouched. */
  private applyTarget(target: WeeklyTarget): void {
    const current = this.rhythmSubject$.value;
    if (!current) return;
    this.rhythmSubject$.next({
      target,
      weeks: current.weeks.map(week => ({...week, met: hasTarget(target) && week.daysMet >= target})),
    });
  }
}
