import {Injectable, NgZone, OnDestroy} from '@angular/core';
import {BehaviorSubject, fromEvent, Observable, Subject} from 'rxjs';
import {debounceTime, map, startWith, takeUntil} from 'rxjs/operators';

@Injectable({
  providedIn: 'root', // Makes the service globally available
})
export class ViewportService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly isMobileSubject = new BehaviorSubject<boolean>(this.checkIsMobile());
  private customWidth = 768; // Default width threshold

  public readonly isMobile$ = this.isMobileSubject.asObservable();

  constructor(private zone: NgZone) {
    this.zone.runOutsideAngular(() => {
      fromEvent(window, 'resize')
        .pipe(
          debounceTime(200),
          map(() => this.checkIsMobile()),
          startWith(this.checkIsMobile()),
          takeUntil(this.destroy$)
        )
        .subscribe((isMobile: boolean) => {
          this.zone.run(() => this.isMobileSubject.next(isMobile));
        });
    });
  }

  setCustomWidth(width: number): void {
    this.customWidth = width;
    // Emit the new value immediately based on the custom width
    this.isMobileSubject.next(this.checkIsMobile());
  }

  private checkIsMobile(): boolean {
    return window.innerWidth < this.customWidth;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
