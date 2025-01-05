import {Component, Input} from '@angular/core';
import {Observable} from 'rxjs';
import {AsyncPipe, NgClass, NgIf} from "@angular/common";
import {TuiLoader} from "@taiga-ui/core";

@Component({
  selector: 'app-button',
  template: `
    <button
      class="relative flex items-center justify-center w-full base"
      [class]="realType + ' ' + customClass"
      [disabled]="disabled || (loading$ | async)"
      [ngClass]="{ 'gradient-button-disabled': disabled || (loading$ | async) }"
    >
      <tui-loader
        *ngIf="loading$ | async"
        class="absolute loader"
      ></tui-loader>
      <span *ngIf="!(loading$ | async)">
        {{ label }}
      </span>
    </button>
  `,
  imports: [
    NgIf,
    AsyncPipe,
    TuiLoader,
    NgClass
  ],
  styleUrls: ['./button.component.less']
})
export class ButtonComponent {
  @Input() loading$!: Observable<boolean>; // Observable for loading state
  @Input() label!: string; // Text to display on the button
  @Input() disabled: boolean = false; // Disabled state
  @Input() type: 'bw' | 'gradient' = 'gradient'; // Predefined button types
  @Input() customClass: string = ''; // Optional custom CSS classes

  get realType() {
    if (this.type === 'bw') {
      return 'black-n-white-button';
    }
    return 'gradient-button';
  }
}
