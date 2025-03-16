import {Component, OnDestroy, OnInit} from '@angular/core';
import {interval, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ButtonComponent} from "../../../button/button.component";
import {LucideAngularModule} from "lucide-angular";
import {LocalStorageService} from "../../../../services/local-storage.service";
import {NgClass} from "@angular/common";

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  imports: [
    ButtonComponent,
    LucideAngularModule,
    NgClass
  ],
  styleUrls: ['./timer.component.less']
})
export class TimerComponent implements OnInit, OnDestroy {
  private readonly DEFAULT_FIRST_DIGIT = 1;
  private readonly DEFAULT_SECOND_DIGIT = 5;

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
    const savedEndTime = this.localStorageService.getTimerEndTimestamp();
    if (savedEndTime) {
      const now = Date.now();
      const remainingTime = Math.max(0, Math.floor((savedEndTime - now) / 60000)); // Convert ms → seconds

      if (remainingTime > 0) {
        this.firstDigit = Math.floor(remainingTime / 10); // Get tens of minutes
        this.secondDigit = remainingTime % 10; // Get remaining single minutes
        this.startTimer(true); // Resume timer
      } else {
        this.localStorageService.clearTimer();
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
    return (this.firstDigit * 10 + this.secondDigit) * 60; // Convert minutes to seconds
  }

  /**
   * Starts the countdown timer.
   * @param resuming Whether the timer is resuming from storage.
   */
  startTimer(resuming = false) {
    if (!resuming && this.state !== 'ready') return; // Prevent restarting

    this.state = 'going';

    if (!resuming) {
      const endTime = Date.now() + this.getTotalTime() * 1000; // Minutes to milliseconds
      this.localStorageService.saveTimerEndTimestamp(endTime);
    }

    interval(60000) // Emit every minute
      .pipe(takeUntil(this.stopTimer$))
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
    this.localStorageService.clearTimer();
  }

  stopTimer() {
    this.stopTimer$.next(); // Stop RxJS interval
    this.localStorageService.clearTimer();
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

      interval(60000)
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
