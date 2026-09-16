import {DestroyRef, Injectable, inject} from '@angular/core';
import {BehaviorSubject, catchError, EMPTY, Subject, debounceTime, distinctUntilChanged, switchMap, tap, throttleTime} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ReadService} from '../read.service';
import {logger} from '../../../shared/logger';
import {ReaderPosition} from './reader-position.model';
import {ReaderPositionStorage} from './reader-position-storage.service';

/**
 * Owns reader progress persistence and its timing policy. The precise place is kept on this device
 * for everyone; the whole-book percentage goes to the server only for a signed-in reader.
 */
@Injectable()
export class ReaderProgressTracker {
  private readonly readService = inject(ReadService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly positionStorage = inject(ReaderPositionStorage);
  private readonly updates$ = new Subject<number>();
  private readonly positionUpdates$ = new Subject<{bookKey: string; position: ReaderPosition}>();
  private readonly book$ = new BehaviorSubject<string | null>(null);
  private bookId: string | null = null;
  private bookKey: string | null = null;
  private currentPercentage = 0;
  private lastSavedPercentage = -1;
  private currentPosition: ReaderPosition | null = null;

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
    ).subscribe(({bookKey, position}) => {
      this.positionStorage.save(bookKey, position);
    });
  }

  /** Starts keeping a place for the book; the server id is null for a guest, whose place stays local. */
  startBook(bookKey: string, serverBookId: string | null): ReaderPosition | null {
    this.flushPosition();
    this.bookKey = bookKey;
    this.bookId = serverBookId;
    this.currentPercentage = 0;
    this.lastSavedPercentage = -1;
    this.currentPosition = null;
    this.book$.next(serverBookId);
    return this.positionStorage.get(bookKey);
  }

  update(percentage: number, position: ReaderPosition): void {
    this.currentPercentage = percentage;
    this.currentPosition = position;
    if (this.bookId !== null) this.updates$.next(percentage);
    if (this.bookKey !== null) this.positionUpdates$.next({bookKey: this.bookKey, position});
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
    if (this.bookKey !== null && this.currentPosition) {
      this.positionStorage.save(this.bookKey, this.currentPosition);
    }
  }
}
