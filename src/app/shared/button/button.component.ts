import {Component, EventEmitter, Input, OnInit, Output, TemplateRef} from '@angular/core';
import {Observable, Subject, takeUntil} from 'rxjs';
import {AsyncPipe, NgClass, NgIf, NgStyle} from "@angular/common";
import {TuiHint, TuiLoader} from "@taiga-ui/core";
import {TuiHintDirection} from "@taiga-ui/core/directives/hint/hint-options.directive";

@Component({
  selector: 'app-button',
  template: `
    <button
      (click)="clickFunction.emit()"
      [disabled]="isDisabled"
      class="relative flex items-center justify-center w-full base"
      [class]="class + ' ' + customClass"
      [style.--tui-background-accent-1]="appearance === 'bw' ? 'var(--text-color)' : 'white'"
      [style.padding]="padding"
      [style.font-size.px]="fontSize"
      [ngClass]="this.appearance === 'gradient' && isDisabled ? 'gradient-button-disabled' : ''"
      [tuiHint]="hint"
      [tuiHintAppearance]="hintAppearance"
      [tuiHintDirection]="hintDirection"
    >
      <tui-loader
        *ngIf="loading$ | async"
        class="absolute loader"
      ></tui-loader>

      <!-- Anything projected from outside (like <i> icons) goes here -->
      <ng-content *ngIf="!(loading$ | async)"></ng-content>

      <span [ngStyle]="{ color: (loading$ | async) ? 'transparent' : 'inherit' }">
        {{ label }}
      </span>
    </button>
  `,
  imports: [
    NgIf,
    AsyncPipe,
    TuiLoader,
    TuiHint,
    NgStyle,
    NgClass
  ],
  styleUrls: ['./button.component.less']
})
export class ButtonComponent implements OnInit {
  private readonly destroy$ = new Subject<void>();
  @Input() loading$!: Observable<boolean>;
  @Input() label!: string;
  @Input() disabled: boolean = false;
  @Input() appearance: 'bw' | 'gradient' = 'gradient';
  @Input() customClass: string = '';
  @Input() fontSize?: number = 14;
  @Input() padding?: string = '';
  @Output() clickFunction = new EventEmitter<void>();

  // Hint-related inputs
  @Input() hint: string | TemplateRef<unknown> = '';
  @Input() hintAppearance = 'onDark';
  @Input() hintDirection: TuiHintDirection = 'top';

  private loadingState: boolean = false;

  ngOnInit() {
    this.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => {
        this.loadingState = loading;
      });
  }

  get class() {
    if (this.appearance === 'bw') {
      return 'black-n-white-button';
    }
    return 'gradient-button';
  }

  get isDisabled(): boolean {
    return this.disabled || this.loadingState;
  }
}
