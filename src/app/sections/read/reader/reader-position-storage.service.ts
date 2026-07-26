import {Injectable, inject} from '@angular/core';
import {LocalStorageService} from '../../../services/local-storage.service';
import {ReaderPosition} from './reader-position.model';

const READER_POSITIONS_KEY = 'reader_positions';

type StoredPositions = Record<string, ReaderPosition>;

@Injectable({
  providedIn: 'root',
})
export class ReaderPositionStorage {
  private readonly localStorage = inject(LocalStorageService);

  get(bookId: number, presentation: string): ReaderPosition | null {
    const key = this.positionKey(bookId, presentation);
    if (!key) return null;

    const position = this.localStorage.getItem<StoredPositions>(READER_POSITIONS_KEY)?.[key];
    return this.isPosition(position) ? position : null;
  }

  save(bookId: number, presentation: string, position: ReaderPosition): void {
    const key = this.positionKey(bookId, presentation);
    if (!key) return;

    const positions = this.localStorage.getItem<StoredPositions>(READER_POSITIONS_KEY) ?? {};
    positions[key] = position;
    this.localStorage.saveItem(READER_POSITIONS_KEY, positions);
  }

  private positionKey(bookId: number, presentation: string): string | null {
    const userId = this.localStorage.getUserInfo()?.id;
    return userId ? `${userId}:${bookId}:${presentation}` : null;
  }

  private isPosition(value: unknown): value is ReaderPosition {
    if (!value || typeof value !== 'object') return false;
    const position = value as Partial<ReaderPosition>;
    const anchor = position.anchor;

    return position.version === 1
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
