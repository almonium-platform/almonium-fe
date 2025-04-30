import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {LocalStorageService} from '../../services/local-storage.service';
import {ParallelMode} from './parallel-mode.type';

@Injectable({
  providedIn: 'root'
})
export class ParallelModeService {
  private parallelModeSubject = new BehaviorSubject<ParallelMode>(
    this.localStorageService.getParallelMode()
  );

  /** Observable emitting the current parallel display mode. */
  readonly mode$ = this.parallelModeSubject.asObservable();

  constructor(private localStorageService: LocalStorageService) {
  }

  /** Sets the parallel display mode and saves it to local storage. */
  setMode(mode: ParallelMode): void {
    // Check if mode actually changed to avoid unnecessary updates/saves
    if (mode !== this.parallelModeSubject.getValue()) {
      this.parallelModeSubject.next(mode);
      this.localStorageService.saveParallelMode(mode);
      console.log('Parallel mode set to:', mode);
    }
  }

  /** Gets the current mode value directly. */
  getCurrentMode(): ParallelMode {
    return this.parallelModeSubject.getValue();
  }
}
