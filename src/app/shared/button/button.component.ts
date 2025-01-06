import {Component, EventEmitter, Input, Output, TemplateRef} from '@angular/core';
import {Observable} from 'rxjs';
import {AsyncPipe, NgIf, NgStyle} from "@angular/common";
import {TuiHint, TuiLoader} from "@taiga-ui/core";
import {TuiHintDirection} from "@taiga-ui/core/directives/hint/hint-options.directive";

@Component({
  selector: 'app-button',
  template: `
    <button
      class="relative flex items-center justify-center w-full base"
      [class]="realType + ' ' + customClass"
      [disabled]="disabled || (loading$ | async)"
      (click)="clickFunction.emit()"
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
    NgStyle
  ],
  styleUrls: ['./button.component.less']
})
export class ButtonComponent {
  @Input() loading$!: Observable<boolean>;
  @Input() label!: string;
  @Input() disabled: boolean = false;
  @Input() type: 'bw' | 'gradient' = 'gradient';
  @Input() customClass: string = '';
  @Output() clickFunction = new EventEmitter<void>();

  // Hint-related inputs
  @Input() hint: string | TemplateRef<unknown> = '';
  @Input() hintAppearance = 'onDark';
  @Input() hintDirection: TuiHintDirection = 'top';

  get realType() {
    if (this.type === 'bw') {
      return 'black-n-white-button';
    }
    return 'gradient-button';
  }
}
