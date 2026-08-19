import { Component, EventEmitter, Input, OnInit, Output, TemplateRef, inject } from '@angular/core';
import {Observable, Subject, takeUntil} from 'rxjs';
import {AsyncPipe, NgStyle} from "@angular/common";
import {Router} from "@angular/router";
import {TuiLoader} from "@taiga-ui/core/components";
import {TuiHintDirection, TuiHintDirective} from "@taiga-ui/core/portals";
import {TuiSkeleton} from "@taiga-ui/kit/directives";

@Component({
  selector: 'app-button',
  template: `
    <button
      (click)="onClick()"
      [disabled]="isDisabled"
      [attr.aria-disabled]="!satisfiable || null"
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
  private router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  @Input() loading$?: Observable<boolean>;
  @Input() label!: string;
  @Input() hoverLabel?: string;
  @Input() disabled = false;
  @Input() satisfiable = true;
  @Input() appearance: 'bw' | 'gradient' | 'solid' | 'underline' | 'text' = 'solid';
  @Input() customClass = '';
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

  private loadingState = false;
  protected isHovered = false;
  @Input() skeleton?: boolean;

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
      return 'secondary-outline-button';
    }
    if (this.appearance === 'underline') {
      return 'underline-button';
    }
    if (this.appearance === 'gradient') {
      return 'gradient-button';
    }
    if (this.appearance === 'solid') {
      return this.satisfiable ? 'solid-button' : 'solid-button incomplete-button';
    }
    return '';
  }

  get isDisabled(): boolean {
    return this.disabled || this.loadingState;
  }

  onClick() {
    if (this.redirectUrl) {
      void this.router.navigate([this.redirectUrl]).then();
      return;
    }
    this.clickFunction.emit();
  }
}
