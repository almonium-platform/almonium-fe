import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgClass} from "@angular/common";
import {TuiButton} from "@taiga-ui/core";
import {TuiButtonClose} from "@taiga-ui/kit";

@Component({
  selector: 'app-dismiss-button',
  template: `
    @if (isOutside) {
      <button
        (click)="onClose()"
        class="close-button"
        [ngClass]="{'outer-close': isOutside, 'inner-close': !isOutside}"
        aria-label="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="black"
          [ngClass]="isOutside ? 'size-8' : 'size-6'"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </button>
    } @else {
      <button
        tuiButtonClose
        tuiIconButton
        type="button"
        (click)="onClose()"
        [ngClass]="relative ? '' : 'inner-close'"
      >
        Close
      </button>
    }
  `,
  imports: [
    NgClass,
    TuiButton,
    TuiButtonClose
  ],
  styleUrls: ['./dismiss-button.component.less']
})
export class DismissButtonComponent {
  @Input() isOutside: boolean = false;
  @Input() relative: boolean = false;
  @Output() close = new EventEmitter<void>();


  onClose() {
    this.close.emit();
  }
}
