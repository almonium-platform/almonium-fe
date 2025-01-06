import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Observable} from 'rxjs';
import {AsyncPipe, NgIf} from "@angular/common";
import {TuiLoader} from "@taiga-ui/core";

@Component({
  selector: 'app-button',
  template: `
    <button
      class="relative flex items-center justify-center w-full base"
      [class]="realType + ' ' + customClass"
      [disabled]="disabled || (loading$ | async)"
      (click)="clickFunction.emit()"
    >
      <tui-loader
        *ngIf="loading$ | async"
        class="absolute loader"
      ></tui-loader>

      <!-- Anything projected from outside (like <i> icons) goes here -->
      <ng-content *ngIf="!(loading$ | async)"></ng-content>

      <span *ngIf="!(loading$ | async)">
        {{ label }}
      </span>
    </button>
  `,
  imports: [
    NgIf,
    AsyncPipe,
    TuiLoader
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

  get realType() {
    if (this.type === 'bw') {
      return 'black-n-white-button';
    }
    return 'gradient-button';
  }
}
