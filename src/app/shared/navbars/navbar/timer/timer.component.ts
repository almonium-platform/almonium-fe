import {Component, OnDestroy, OnInit} from '@angular/core';
import {interval, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ButtonComponent} from "../../../button/button.component";
import {LucideAngularModule} from "lucide-angular";
import {LocalStorageService} from "../../../../services/local-storage.service";

const TIMER_END_TIMESTAMP_KEY = 'timer_end_timestamp';

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  imports: [
    ButtonComponent,
    LucideAngularModule
  ],
  styleUrls: ['./timer.component.less']
})
export class TimerComponent implements OnInit, OnDestroy {
  private readonly DEFAULT_FIRST_DIGIT = 1;
  private readonly DEFAULT_SECOND_DIGIT = 0;

  protected firstDigit = this.DEFAULT_FIRST_DIGIT;
  protected secondDigit = this.DEFAULT_SECOND_DIGIT;
  protected state: 'ready' | 'going' | 'paused' = 'ready';

  private stopTimer$ = new Subject<void>(); // Used for cleanup when stopping timer

  constructor(private localStorageService: LocalStorageService) {
  }

  ngOnInit() {
    this.checkAndResumeTimer();
  }

  /**
   * Checks localStorage for an active timer and resumes it if needed.
   */
  private checkAndResumeTimer() {
    const savedEndTime = this.localStorageService.getItem<number>(TIMER_END_TIMESTAMP_KEY);
    if (savedEndTime) {
      const now = Date.now();
      const remainingTime = Math.max(0, Math.floor((savedEndTime - now) / 1000));

      if (remainingTime > 0) {
        this.firstDigit = Math.floor(remainingTime / 10);
        this.secondDigit = remainingTime % 10;
        this.startTimer(true); // Resume timer
      } else {
        this.localStorageService.removeItem(TIMER_END_TIMESTAMP_KEY); // Cleanup expired timer
      }
    }
  }

  increaseDigit(position: 'first' | 'second') {
    if (position === 'first' && this.firstDigit < 9) {
      this.firstDigit++;
    }
    if (position === 'second' && this.secondDigit < 9) {
      this.secondDigit++;
    }
  }

  decreaseDigit(position: 'first' | 'second') {
    if (position === 'first' && this.firstDigit > 0) {
      this.firstDigit--;
    }
    if (position === 'second' && this.secondDigit > 0) {
      this.secondDigit--;
    }
  }

  protected getTotalTime() {
    return this.firstDigit * 10 + this.secondDigit;
  }

  /**
   * Starts the countdown timer.
   * @param resuming Whether the timer is resuming from storage.
   */
  startTimer(resuming = false) {
    if (!resuming && this.state !== 'ready') return; // Prevent restarting

    this.state = 'going';

    // Save timer end timestamp to localStorage
    if (!resuming) {
      const endTime = Date.now() + this.getTotalTime() * 1000;
      this.localStorageService.saveItem(TIMER_END_TIMESTAMP_KEY, endTime);
    }

    interval(1000) // Emit every second
      .pipe(takeUntil(this.stopTimer$)) // Stop when `stopTimer$` emits
      .subscribe(() => {
        this.decrementTime();
      });
  }

  decrementTime() {
    if (this.firstDigit === 0 && this.secondDigit === 0) {
      this.onTimerEnd(); // Custom logic when timer reaches 0.0
      this.stopTimer(); // Stops the timer
      return;
    }

    if (this.secondDigit === 0) {
      if (this.firstDigit > 0) {
        this.firstDigit--;
        this.secondDigit = 9;
      }
    } else {
      this.secondDigit--;
    }
  }

  private onTimerEnd() {
    alert("Time's up!");
    this.localStorageService.removeItem(TIMER_END_TIMESTAMP_KEY); // Clear stored timer
  }

  stopTimer() {
    this.stopTimer$.next(); // Stop RxJS interval
    this.localStorageService.removeItem(TIMER_END_TIMESTAMP_KEY); // Remove saved timestamp
    this.firstDigit = this.DEFAULT_FIRST_DIGIT;
    this.secondDigit = this.DEFAULT_SECOND_DIGIT;
    this.state = 'ready';
  }

  togglePauseTimer() {
    if (this.state === 'going') {
      this.state = 'paused';
      this.stopTimer$.next(); // Stop interval updates
    } else if (this.state === 'paused') {
      this.state = 'going';

      interval(1000)
        .pipe(takeUntil(this.stopTimer$))
        .subscribe(() => {
          this.decrementTime();
        });
    }
  }

  ngOnDestroy() {
    this.stopTimer$.next(); // Cleanup on destroy
    this.stopTimer$.complete();
  }

  hideArrows() {
    return this.state !== 'ready';
  }
}
