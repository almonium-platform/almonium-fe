import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Observable} from 'rxjs';
import {NgIf} from '@angular/common';
import {ButtonComponent} from '../button/button.component'; // Adjust path as needed

@Component({
  selector: 'app-edit-button',
  template: `
    <app-button
      [label]="editable ? label : ''"
      [appearance]="'bw'"
      [loading$]="loading$"
      [disabled]="disabled"
      [customClass]="'edit-btn ' + (editable ? '' : 'circular-icon')"
      (clickFunction)="this.clickFunction.emit()"
    >
      <i
        *ngIf="!editable"
        class="fa-regular fa-pen-to-square text-sm"
      ></i>
    </app-button>
  `,
  standalone: true,
  imports: [NgIf, ButtonComponent],
})
export class EditButtonComponent {
  @Input() label: string = '';
  @Input() editable: boolean = false;
  @Input() disabled: boolean = false;
  @Input() loading$!: Observable<boolean>;
  @Output() clickFunction = new EventEmitter<void>();
}
