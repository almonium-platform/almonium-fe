import {logger} from "../../../logger";
import {TuiNotificationService} from "@taiga-ui/core/components";
import { Injectable, inject } from '@angular/core';
import {interval, Subscription} from 'rxjs';
import {LocalStorageService} from "../../../../services/local-storage.service";

@Injectable({
  providedIn: 'root'
})
export class TimerMonitorService {
  private localStorageService = inject(LocalStorageService);
  private alertService = inject(TuiNotificationService);

  private checkInterval = 1000;
  private subscription: Subscription | null = null;

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
    const savedEndTime = this.localStorageService.getTimerEndTimestamp();
    if (!savedEndTime) return;

    const now = Date.now();
    if (now >= savedEndTime) {
      this.localStorageService.clearTimer();
      this.triggerTimerEndAlert();
    }
  }

  /**
   * Logic to execute when the timer reaches 0.0.
   */
  private triggerTimerEndAlert() {
    logger.debug("⏳ Timer expired! Triggering alert...");
    this.alertService.open("⏳ Time's up!", {appearance: "warning"}).subscribe();
  }
}
