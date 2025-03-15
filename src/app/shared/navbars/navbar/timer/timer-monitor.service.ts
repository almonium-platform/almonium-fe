import {Injectable} from '@angular/core';
import {interval, Subscription} from 'rxjs';
import {TuiAlertService} from '@taiga-ui/core';
import {LocalStorageService} from "../../../../services/local-storage.service";

const TIMER_END_TIMESTAMP_KEY = 'timer_end_timestamp';

@Injectable({
  providedIn: 'root'
})
export class TimerMonitorService {
  private checkInterval = 1000; // Check every second
  private subscription: Subscription | null = null;

  constructor(
    private localStorageService: LocalStorageService,
    private alertService: TuiAlertService
  ) {
  }

  /**
   * Starts the background timer monitoring process.
   */
  startMonitoring() {
    if (this.subscription) return; // Prevent multiple intervals

    this.subscription = interval(this.checkInterval).subscribe(() => {
      this.checkTimerExpiration();
    });
  }

  /**
   * Stops the monitoring process.
   */
  stopMonitoring() {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  /**
   * Checks if the stored timer has expired and triggers an alert.
   */
  private checkTimerExpiration() {
    const savedEndTime = this.localStorageService.getItem<number>(TIMER_END_TIMESTAMP_KEY);
    if (savedEndTime) {
      const now = Date.now();
      if (now >= savedEndTime) {
        this.localStorageService.removeItem(TIMER_END_TIMESTAMP_KEY); // Cleanup expired timer
        this.triggerTimerEndAlert();
      }
    }
  }

  /**
   * Logic to execute when the timer reaches 0.0.
   */
  private triggerTimerEndAlert() {
    console.log("⏳ Timer expired! Triggering alert...");
    this.alertService.open("⏳ Time's up!", {appearance: "warning"}).subscribe();
  }
}
