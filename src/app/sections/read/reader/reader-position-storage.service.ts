import {Injectable, inject} from '@angular/core';
import {LocalStorageService} from '../../../services/local-storage.service';
import {ReaderPosition} from './reader-position.model';

const READER_POSITIONS_KEY = 'reader_positions';

type StoredPositions = Record<string, ReaderPosition>;

/** One place per book and reader; a guest's place is kept on this device under its own key. */
@Injectable({
  providedIn: 'root',
})
export class ReaderPositionStorage {
  private readonly localStorage = inject(LocalStorageService);

  get(bookKey: string): ReaderPosition | null {
    const position = this.localStorage.getItem<StoredPositions>(READER_POSITIONS_KEY)?.[this.positionKey(bookKey)];
    return this.isPosition(position) ? position : null;
  }

  save(bookKey: string, position: ReaderPosition): void {
    const positions = this.localStorage.getItem<StoredPositions>(READER_POSITIONS_KEY) ?? {};
    positions[this.positionKey(bookKey)] = position;
    this.localStorage.saveItem(READER_POSITIONS_KEY, positions);
  }

  private positionKey(bookKey: string): string {
    return `${this.localStorage.getUserInfo()?.id ?? 'guest'}:${bookKey}`;
  }

  private isPosition(value: unknown): value is ReaderPosition {
    if (!value || typeof value !== 'object') return false;
    const position = value as Partial<ReaderPosition>;
    const anchor = position.anchor;

    return position.version === 2
      && Number.isInteger(position.chapter) && position.chapter! >= 0
      && typeof position.presentation === 'string'
      && this.isFiniteNonNegative(position.scrollTop)
      && this.isFiniteNonNegative(position.scrollHeight)
      && this.isFiniteNonNegative(position.clientWidth)
      && this.isFiniteNonNegative(position.percentage)
      && position.percentage <= 100
      && (anchor === null || (
        typeof anchor === 'object'
        && Array.isArray(anchor.path)
        && anchor.path.every(index => Number.isInteger(index) && index >= 0)
        && typeof anchor.offset === 'number'
        && Number.isFinite(anchor.offset)
      ));
  }

  private isFiniteNonNegative(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }
}
