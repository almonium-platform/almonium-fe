import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';

import {interval, Subject, Subscription} from 'rxjs';
import {GifPlayerComponent} from '../gif-player/gif-player.component'; // Adjust path if needed

@Component({
  selector: 'app-loading-indicator',
  imports: [
    GifPlayerComponent
  ],
  templateUrl: './loading-indicator.component.html',
  styleUrls: ['./loading-indicator.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingIndicatorComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  @Input() baseText = 'Loading';

  animatedText = '';
  private intervalSubscription: Subscription | null = null;
  private replayTimeout?: ReturnType<typeof setTimeout>;
  private readonly animationInterval = 350; // Animation speed
  protected replayGifTrigger = new Subject<void>();

  ngOnInit(): void {
    this.startAnimation();
    // Trigger the gif replay shortly after init to ensure view is ready
    this.replayTimeout = setTimeout(() => this.replayGifTrigger.next(), 0);
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    clearTimeout(this.replayTimeout);
  }

  private startAnimation(): void {
    this.stopAnimation();

    const messages = [
      this.baseText,
      `${this.baseText}.`,
      `${this.baseText}..`,
      `${this.baseText}...`
    ];
    let index = 0;

    this.animatedText = messages[index];
    this.cdr.markForCheck();

    this.intervalSubscription = interval(this.animationInterval).subscribe(() => {
      index = (index + 1) % messages.length;
      this.animatedText = messages[index];
      this.cdr.markForCheck();
    });
  }

  private stopAnimation(): void {
    if (this.intervalSubscription) {
      this.intervalSubscription.unsubscribe();
      this.intervalSubscription = null;
    }
  }
}
