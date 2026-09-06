import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';

import {interval, Subscription} from 'rxjs';
import {EmblemComponent} from '../emblem/emblem.component';

@Component({
  selector: 'app-loading-indicator',
  imports: [
    EmblemComponent
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
  private readonly animationInterval = 350; // Animation speed

  ngOnInit(): void {
    this.startAnimation();
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
