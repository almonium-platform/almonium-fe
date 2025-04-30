import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {LocalStorageService} from '../../services/local-storage.service'; // Adjust path
import {ParallelMode} from './parallel-mode.type';
import {TuiAlertService} from '@taiga-ui/core'

@Injectable({
  providedIn: 'root'
})
export class ParallelModeService {
  private parallelModeSubject = new BehaviorSubject<ParallelMode>(
    this.localStorageService.getParallelMode() // Load initial mode
  );

  readonly mode$ = this.parallelModeSubject.asObservable();
  private readonly NARROW_SCREEN_THRESHOLD = 650; // Define breakpoint in pixels

  constructor(
    private localStorageService: LocalStorageService,
    private alertService: TuiAlertService
  ) {
  }

  /** Sets the parallel display mode and saves it to local storage. */
  setMode(requestedMode: ParallelMode): void {
    const currentMode = this.getCurrentMode();

    // --- Check for 'side' mode on narrow screens ---
    if (requestedMode === 'side' && window.innerWidth < this.NARROW_SCREEN_THRESHOLD) {
      console.warn(`Side-by-side mode requested on narrow screen (${window.innerWidth}px < ${this.NARROW_SCREEN_THRESHOLD}px). Preventing change and reverting UI.`);

      // Show the alert notification
      this.alertService.open(
        'Side-by-side view is not available on narrow screens. Please use Overlay or Inline mode.',
        {
          label: 'Mode Unavailable',
          appearance: 'warning',
        }
      ).subscribe();

      // --- Add this line to fix the UI ---
      // Re-emit the *current* mode to force subscribers (like the settings component)
      // to update their state back to the allowed value.
      // Use setTimeout to ensure this happens *after* the current change detection cycle
      // which might have already visually updated the segmented control.
      setTimeout(() => {
        if (this.getCurrentMode() !== currentMode) {
          // This check is unlikely needed with setTimeout but adds safety
          console.log(`Mode was unexpectedly changed to ${this.getCurrentMode()}, reverting to ${currentMode}`);
        }
        this.parallelModeSubject.next(currentMode);
      }, 0);


      // Do *not* update local storage and stop further processing
      return;
    }

    // Only proceed if the mode is actually changing (and wasn't blocked above)
    if (requestedMode === currentMode) {
      // This check handles cases where the mode wasn't blocked but is already the active one
      console.log(`Mode ${requestedMode} is already active.`);
      return;
    }

    // If the check passed and mode is different, proceed with the update
    this.parallelModeSubject.next(requestedMode);
    this.localStorageService.saveParallelMode(requestedMode);
    console.log('Parallel mode set to:', requestedMode);
  }

  /** Gets the current mode value directly. */
  getCurrentMode(): ParallelMode {
    return this.parallelModeSubject.getValue();
  }
}
