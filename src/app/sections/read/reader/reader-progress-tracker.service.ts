import {DestroyRef, Injectable, inject} from '@angular/core';
import {BehaviorSubject, catchError, EMPTY, Subject, debounceTime, distinctUntilChanged, switchMap, tap, throttleTime} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ReadService} from '../read.service';
import {logger} from '../../../shared/logger';
import {ReaderPosition} from './reader-position.model';
import {ReaderPositionStorage} from './reader-position-storage.service';

/** Owns reader progress persistence and its timing policy. */
@Injectable()
export class ReaderProgressTracker {
  private readonly readService = inject(ReadService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly positionStorage = inject(ReaderPositionStorage);
  private readonly updates$ = new Subject<number>();
  private readonly positionUpdates$ = new Subject<{
    bookId: string;
    presentation: string;
    position: ReaderPosition;
  }>();
  private readonly book$ = new BehaviorSubject<string | null>(null);
  private bookId: string | null = null;
  private currentPercentage = 0;
  private lastSavedPercentage = -1;
  private currentPosition: ReaderPosition | null = null;
  private presentation = 'base';

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

    this.positionUpdates$.pipe(
      debounceTime(250),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({bookId, presentation, position}) => {
      this.positionStorage.save(bookId, presentation, position);
    });
  }

  startBook(bookId: string): ReaderPosition | null {
    this.flushPosition();
    this.bookId = bookId;
    this.currentPercentage = 0;
    this.lastSavedPercentage = -1;
    this.currentPosition = null;
    this.presentation = 'base';
    this.book$.next(bookId);
    return this.positionStorage.get(bookId, this.presentation);
  }

  startPresentation(presentation: string): ReaderPosition | null {
    this.flushPosition();
    this.presentation = presentation;
    this.currentPosition = null;
    return this.bookId === null ? null : this.positionStorage.get(this.bookId, presentation);
  }

  update(percentage: number, position: ReaderPosition): void {
    this.currentPercentage = percentage;
    this.currentPosition = position;
    this.updates$.next(percentage);
    if (this.bookId !== null) {
      this.positionUpdates$.next({
        bookId: this.bookId,
        presentation: this.presentation,
        position,
      });
    }
  }

  saveOnExit(useBeacon: boolean): void {
    this.flushPosition();
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

  private flushPosition(): void {
    if (this.bookId !== null && this.currentPosition) {
      this.positionStorage.save(this.bookId, this.presentation, this.currentPosition);
    }
  }
}
