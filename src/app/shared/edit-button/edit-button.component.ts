import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgClass, NgIf} from "@angular/common";

@Component({
    selector: 'app-edit-button',
    template: `
      <button class="black-n-white-button edit-btn"
              [ngClass]="{ 'circular-icon': !editable , 'disabled': disabled }"
              (click)="onClick()"
              [disabled]="disabled"
      >
        {{ editable ? label : '' }}
        <i *ngIf="!editable" class="fa-regular fa-pen-to-square text-sm"></i>
      </button>
    `,
    imports: [
        NgClass,
        NgIf
    ],
    styleUrls: ['./edit-button.component.less']
})
export class EditButtonComponent {
  @Input() label: string = '';
  @Input() editable: boolean = false;
  @Input() disabled: boolean = false;
  @Output() clickFunction = new EventEmitter<void>();

  onClick() {
    this.clickFunction.emit();
  }
}
