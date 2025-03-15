import {Component, OnDestroy} from '@angular/core';
import {interval, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ButtonComponent} from "../../../button/button.component";
import {LucideAngularModule} from "lucide-angular";

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  imports: [
    ButtonComponent,
    LucideAngularModule
  ],
  styleUrls: ['./timer.component.less']
})
export class TimerComponent implements OnDestroy {
  private readonly DEFAULT_FIRST_DIGIT = 1;
  private readonly DEFAULT_SECOND_DIGIT = 0;

  protected firstDigit = this.DEFAULT_FIRST_DIGIT;
  protected secondDigit = this.DEFAULT_SECOND_DIGIT;
  protected state: 'ready' | 'going' | 'paused' = 'ready';

  private stopTimer$ = new Subject<void>(); // Used for cleanup when stopping timer

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

  startTimer() {
    if (this.state !== 'ready') return; // Prevent restarting while running
    this.state = 'going';

    interval(1000) // Emit value every second
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
  }

  stopTimer() {
    this.stopTimer$.next(); // Stop RxJS interval
    this.firstDigit = this.DEFAULT_FIRST_DIGIT;
    this.secondDigit = this.DEFAULT_SECOND_DIGIT;
    this.state = 'ready';
  }

  showArrows() {
    return this.state !== 'ready';
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
}
