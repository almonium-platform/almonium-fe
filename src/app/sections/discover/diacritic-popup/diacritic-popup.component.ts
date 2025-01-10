import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgStyle} from "@angular/common";

@Component({
  selector: 'app-diacritic-popup',
  template: `
    @if (options.length > 0) {
      <div class="diacritic-popup" [ngStyle]="position">
        @for (option of options; track option; let i = $index) {
          <span
            (click)="selectOption(option)"
            [class.focused]="i === focusedIndex"
            class="letter">
            {{ option }}
          </span>
        }
      </div>
    }
  `,
  imports: [
    NgStyle
  ],
  styleUrls: ['./diacritic-popup.component.less']
})
export class DiacriticPopupComponent {
  @Input() options: string[] = [];
  @Input() position = {top: '0px', left: '0px'};
  @Input() focusedIndex = 0;
  @Output() optionSelected = new EventEmitter<string>();

  selectOption(option: string) {
    this.optionSelected.emit(option);
  }
}
