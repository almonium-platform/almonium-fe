import {DestroyRef, Injectable, inject} from '@angular/core';
import {BehaviorSubject, catchError, EMPTY, Subject, debounceTime, distinctUntilChanged, switchMap, tap, throttleTime} from 'rxjs';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ReadService} from '../read.service';
import {logger} from '../../../shared/logger';
import {ReaderPosition} from './reader-position.model';
import {ReaderPositionStorage} from './reader-position-storage.service';
import {ReadingPlace} from '../book.model';

interface ProgressUpdate {
  percentage: number;
  place: ReadingPlace | null;
}

function sameUpdate(a: ProgressUpdate, b: ProgressUpdate): boolean {
  return a.percentage === b.percentage && a.place?.chapter === b.place?.chapter && a.place?.chapterCount === b.place?.chapterCount;
}

/**
 * Owns reader progress persistence and its timing policy. The precise place is kept on this device
 * for everyone; the whole-book percentage and the chapter it is in go to the server only for a
 * signed-in reader, so every shelf can say "12% · chapter 3 of 24".
 */
@Injectable()
export class ReaderProgressTracker {
  private readonly readService = inject(ReadService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly positionStorage = inject(ReaderPositionStorage);
  private readonly updates$ = new Subject<ProgressUpdate>();
  private readonly positionUpdates$ = new Subject<{bookKey: string; position: ReaderPosition}>();
  private readonly book$ = new BehaviorSubject<string | null>(null);
  private bookId: string | null = null;
  private bookKey: string | null = null;
  private currentPercentage = 0;
  private currentPlace: ReadingPlace | null = null;
  private lastSaved: ProgressUpdate | null = null;
  private currentPosition: ReaderPosition | null = null;

  constructor() {
    this.book$.pipe(
      switchMap(bookId => bookId === null ? EMPTY : this.updates$.pipe(
        debounceTime(750),
        distinctUntilChanged(sameUpdate),
        throttleTime(10_000, undefined, {leading: false, trailing: true}),
        switchMap(update => this.readService.saveProgress(bookId, update.percentage, update.place).pipe(
          tap(() => this.lastSaved = update),
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
    this.currentPlace = null;
    this.lastSaved = null;
    this.currentPosition = null;
    this.book$.next(serverBookId);
    return this.positionStorage.get(bookKey);
  }

  update(percentage: number, position: ReaderPosition, place: ReadingPlace | null = null): void {
    this.currentPercentage = percentage;
    this.currentPlace = place;
    this.currentPosition = position;
    if (this.bookId !== null) this.updates$.next({percentage, place});
    if (this.bookKey !== null) this.positionUpdates$.next({bookKey: this.bookKey, position});
  }

  saveOnExit(useBeacon: boolean): void {
    this.flushPosition();
    const update: ProgressUpdate = {percentage: this.currentPercentage, place: this.currentPlace};
    if (this.bookId === null || (this.lastSaved !== null && sameUpdate(update, this.lastSaved))) return;

    if (useBeacon) {
      if (this.readService.sendProgressBeacon(this.bookId, update.percentage, update.place)) {
        this.lastSaved = update;
      }
      return;
    }

    this.readService.saveProgress(this.bookId, update.percentage, update.place)
      .subscribe({
        next: () => this.lastSaved = update,
        error: error => logger.error(`Could not save reading progress for ${this.bookId}`, error),
      });
  }

  private flushPosition(): void {
    if (this.bookKey !== null && this.currentPosition) {
      this.positionStorage.save(this.bookKey, this.currentPosition);
    }
  }
}
