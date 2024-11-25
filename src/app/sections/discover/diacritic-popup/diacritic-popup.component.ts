import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgForOf, NgIf, NgStyle} from "@angular/common";

@Component({
    selector: 'app-diacritic-popup',
    template: `
    <div class="diacritic-popup" *ngIf="options.length > 0" [ngStyle]="position">
      <span *ngFor="let option of options; let i = index"
            (click)="selectOption(option)"
            [class.focused]="i === focusedIndex"
            class="letter">
        {{ option }}
      </span>
    </div>
  `,
    imports: [
        NgForOf,
        NgIf,
        NgStyle
    ],
    styleUrls: ['./diacritic-popup.component.less']
})
export class DiacriticPopupComponent {
  @Input() options: string[] = [];
  @Input() position = { top: '0px', left: '0px' };
  @Input() focusedIndex = 0;
  @Output() optionSelected = new EventEmitter<string>();

  selectOption(option: string) {
    this.optionSelected.emit(option);
  }
}
