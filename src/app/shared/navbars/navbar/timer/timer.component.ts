import {Component} from '@angular/core';
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
export class TimerComponent {
  private readonly DEFAULT_FIRST_DIGIT = 1;
  private readonly DEFAULT_SECOND_DIGIT = 0;

  protected firstDigit = this.DEFAULT_FIRST_DIGIT;
  protected secondDigit = this.DEFAULT_SECOND_DIGIT

  protected state: 'ready' | 'going' | 'paused' = 'ready';

  // Increases the digit but keeps it within 0-9
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

  startTimer() {
    this.state = 'going';
  }

  protected getTotalTime() {
    return this.firstDigit * 10 + this.secondDigit;
  }

  stopTimer() {
    this.firstDigit = this.DEFAULT_FIRST_DIGIT;
    this.secondDigit = this.DEFAULT_SECOND_DIGIT
    this.state = 'ready';
  }

  showArrows() {
    return this.state !== 'ready';
  }

  togglePauseTimer() {
    if (this.state === 'paused') {
      this.state = 'going';
    } else if (this.state === 'going') {
      this.state = 'paused';
    } else {
      console.error('Invalid state');
    }
  }
}
