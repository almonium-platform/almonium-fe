import {Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Subject, interval, Subscription} from 'rxjs';
import {GifPlayerComponent} from '../gif-player/gif-player.component'; // Adjust path if needed

@Component({
  selector: 'app-loading-indicator',
  imports: [
    CommonModule,
    GifPlayerComponent
  ],
  templateUrl: './loading-indicator.component.html',
  styleUrls: ['./loading-indicator.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingIndicatorComponent implements OnInit, OnDestroy {
  @Input() baseText: string = 'Loading';

  animatedText: string = '';
  private intervalSubscription: Subscription | null = null;
  private readonly animationInterval = 350; // Animation speed
  protected replayGifTrigger = new Subject<void>();

  constructor(private cdr: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    this.startAnimation();
    // Trigger the gif replay shortly after init to ensure view is ready
    setTimeout(() => this.replayGifTrigger.next(), 0);
  }

  ngOnDestroy(): void {
    this.stopAnimation();
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
