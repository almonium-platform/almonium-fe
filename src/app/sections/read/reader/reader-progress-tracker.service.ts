import {DestroyRef, Injectable, inject} from '@angular/core';
import {BehaviorSubject, catchError, EMPTY, Subject, debounceTime, distinctUntilChanged, switchMap, tap, throttleTime} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ReadService} from '../read.service';
import {logger} from '../../../shared/logger';

/** Owns reader progress persistence and its timing policy. */
@Injectable()
export class ReaderProgressTracker {
  private readonly readService = inject(ReadService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly updates$ = new Subject<number>();
  private readonly book$ = new BehaviorSubject<number | null>(null);
  private bookId: number | null = null;
  private currentPercentage = 0;
  private lastSavedPercentage = -1;

  constructor() {
    this.book$.pipe(
      switchMap(bookId => bookId === null ? EMPTY : this.updates$.pipe(
        debounceTime(750),
        distinctUntilChanged(),
        throttleTime(10_000, undefined, {leading: false, trailing: true}),
        switchMap(percentage => this.readService.saveProgress(bookId, percentage).pipe(
          tap(() => this.lastSavedPercentage = percentage),
          // A later scroll update should still be able to save after a transient failure.
          catchError(error => {
            logger.error(`Could not save reading progress for ${bookId}`, error);
            return EMPTY;
          }),
        )),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  startBook(bookId: number): void {
    this.bookId = bookId;
    this.currentPercentage = 0;
    this.lastSavedPercentage = -1;
    this.book$.next(bookId);
  }

  update(percentage: number): void {
    this.currentPercentage = percentage;
    this.updates$.next(percentage);
  }

  saveOnExit(useBeacon: boolean): void {
    if (this.bookId === null || this.currentPercentage === this.lastSavedPercentage) return;

    if (useBeacon) {
      if (this.readService.sendProgressBeacon(this.bookId, this.currentPercentage)) {
        this.lastSavedPercentage = this.currentPercentage;
      }
      return;
    }

    const percentage = this.currentPercentage;
    this.readService.saveProgress(this.bookId, percentage)
      .subscribe({
        next: () => this.lastSavedPercentage = percentage,
        error: error => logger.error(`Could not save reading progress for ${this.bookId}`, error),
      });
  }
}
