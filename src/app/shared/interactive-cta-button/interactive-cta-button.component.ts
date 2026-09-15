import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {TuiLoader} from '@taiga-ui/core/components';

@Component({
  selector: 'app-interactive-cta-button',
  template: `
    <div class="interactive-cta-btn-container">
      <button
        class="cta-btn"
        [disabled]="disabled || isLoading"
        (click)="onClick()"
      >
        @if (isLoading) {
          <tui-loader class="loader"></tui-loader>
        }

        <!-- button text: hidden while loading -->
        <span
          class="btn-text"
          [style.visibility]="isLoading ? 'hidden' : 'visible'"
        >
          {{ text }}
        </span>
      </button>
    </div>
  `,
  styleUrls: ['./interactive-cta-button.component.less'],
  imports: [TuiLoader],
})
export class InteractiveCtaButtonComponent implements OnInit, OnDestroy {
  @Input() text = 'Click Me';
  @Input() loading$?: Observable<boolean>;
  @Input() disabled = false;
  @Output() buttonClick = new EventEmitter<void>();
  isLoading = false;

  private readonly destroy$ = new Subject<void>();

  ngOnInit() {
    if (this.loading$) {
      this.loading$
        .pipe(takeUntil(this.destroy$))
        .subscribe((loading) => (this.isLoading = loading));
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onClick() {
    if (this.disabled || this.isLoading) {
      return;
    }
    this.buttonClick.emit();
  }
}
