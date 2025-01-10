import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Observable} from 'rxjs';
import {ButtonComponent} from "../button/button.component";

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
      @if (!editable) {
        <i
          class="fa-regular fa-pen-to-square text-sm"
        ></i>
      }
    </app-button>
  `,
  standalone: true,
  imports: [
    ButtonComponent
  ],
})
export class EditButtonComponent {
  @Input() label: string = '';
  @Input() editable: boolean = false;
  @Input() disabled: boolean = false;
  @Input() loading$!: Observable<boolean>;
  @Output() clickFunction = new EventEmitter<void>();
}
