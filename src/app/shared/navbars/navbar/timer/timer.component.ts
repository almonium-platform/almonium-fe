import { Component } from '@angular/core';

@Component({
  selector: 'app-timer',
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.less']
})
export class TimerComponent {
  isTimerOpen = true; // Controls popover visibility
  firstDigit = 0;
  secondDigit = 0;

  // Increases the digit but keeps it within 0-9
  increaseDigit(position: 'first' | 'second') {
    if (position === 'first' && this.firstDigit < 9) {
      this.firstDigit++;
    }
    if (position === 'second' && this.secondDigit < 9) {
      this.secondDigit++;
    }
  }

  // Decreases the digit but keeps it within 0-9
  decreaseDigit(position: 'first' | 'second') {
    if (position === 'first' && this.firstDigit > 0) {
      this.firstDigit--;
    }
    if (position === 'second' && this.secondDigit > 0) {
      this.secondDigit--;
    }
  }

  startTimer() {
    const totalTime = this.firstDigit * 10 + this.secondDigit;
    console.log(`Timer started for ${totalTime} seconds`);
  }

  timerOnClickOutside(event: Event) {
    this.isTimerOpen = false; // Close when clicking outside
  }
}
