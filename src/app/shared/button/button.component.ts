import {Component, EventEmitter, Input, OnInit, Output, TemplateRef} from '@angular/core';
import {Observable, Subject, takeUntil} from 'rxjs';
import {AsyncPipe, NgStyle} from "@angular/common";
import {Router} from "@angular/router";
import {TuiHintDirection, TuiHintDirective, TuiLoader} from "@taiga-ui/core";
import {TuiSkeleton} from "@taiga-ui/kit";

@Component({
  selector: 'app-button',
  template: `
    <button
      (click)="onClick()"
      [disabled]="isDisabled"
      [type]="type"
      [tuiSkeleton]="!!skeleton"
      class="relative flex items-center justify-center w-full base"
      [class]="class + ' ' + customClass"
      [style.--tui-background-accent-1]="appearance === 'bw' ? 'var(--text-color)' : 'white'"
      [style.flex-direction]="reverse ? 'row-reverse' : 'row'"
      [style.width]="width === 'fit' ? 'fit-content' : width === 'full' ? '100%' : null"
      [style.padding]="padding"
      [style.font-size.px]="fontSize"
      [style.font-weight]="fontWeight"
      [style.color]="color"
      [style.opacity]="appearance === 'text' && ((loading$ | async) || disabled) ? 0.5 : 1"
      [style.gap]="gap"
      [tuiHint]="hint"
      [tuiHintAppearance]="hintAppearance"
      [tuiHintDirection]="hintDirection"
      [title]="title"
      (mouseenter)="isHovered = true"
      (mouseleave)="isHovered = false"
      (focus)="isHovered = true"
      (blur)="isHovered = false"
    >
      @if ((loading$ | async) && appearance !== 'text') {
        <tui-loader
          class="absolute loader"
        ></tui-loader>
      }

      <!-- Anything projected from outside (like <i> icons) goes here -->
      <div [style.visibility]="(loading$ | async) ? 'hidden' : 'visible'" class="flex items-center">
        <ng-content></ng-content>
      </div>

      <span [ngStyle]="{ color: ((loading$ | async) && appearance !== 'text') ? 'transparent' : 'inherit' }">
          {{ isHovered && hoverLabel ? hoverLabel : label }}
      </span>
    </button>
  `,
  imports: [
    AsyncPipe,
    NgStyle,
    TuiLoader,
    TuiHintDirective,
    TuiSkeleton,
  ],
})
export class ButtonComponent implements OnInit {
  private readonly destroy$ = new Subject<void>();
  @Input() loading$?: Observable<boolean>;
  @Input() label!: string;
  @Input() hoverLabel?: string;
  @Input() disabled: boolean = false;
  @Input() appearance: 'bw' | 'gradient' | 'underline' | 'text' = 'gradient';
  @Input() customClass: string = '';
  @Input() fontSize?: number;
  @Input() fontWeight?: number;
  @Input() color?: string;
  @Input() gap?: string = '0';
  @Input() reverse?: boolean = false;
  @Input() width?: 'fit' | 'full' | 'unset' = 'unset';
  @Input() title?: string = '';
  @Input() padding?: string = '';
  @Input() type?: 'button' | 'submit' | 'reset' = 'submit';
  @Input() redirectUrl?: string;
  @Output() clickFunction = new EventEmitter<void>();

  // Hint-related inputs
  @Input() hint: string | TemplateRef<unknown> = '';
  @Input() hintAppearance = 'onDark';
  @Input() hintDirection: TuiHintDirection = 'top';

  private loadingState: boolean = false;
  protected isHovered = false;
  @Input() skeleton?: boolean;

  constructor(private router: Router) {
  }

  ngOnInit() {
    if (this.loading$) {
      this.loading$
        .pipe(takeUntil(this.destroy$))
        .subscribe((loading) => {
          this.loadingState = loading;
        });
    }
  }

  get class() {
    if (this.appearance === 'bw') {
      return 'black-n-white-button';
    }
    if (this.appearance === 'underline') {
      return 'underline-button';
    }
    if (this.appearance === 'gradient') {
      return 'gradient-button';
    }
    return '';
  }

  get isDisabled(): boolean {
    return this.disabled || this.loadingState;
  }

  onClick() {
    if (this.redirectUrl) {
      this.router.navigate([this.redirectUrl]).then();
      return;
    }
    this.clickFunction.emit();
  }
}
