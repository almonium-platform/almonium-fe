import {Component, EventEmitter, HostListener, Input, Output} from '@angular/core';
import {NgClass, NgIf} from "@angular/common";
import {DismissButtonComponent} from "../elements/dismiss-button/dismiss-button.component";

@Component({
    selector: 'app-action-modal',
    imports: [
        NgIf,
        DismissButtonComponent,
        NgClass
    ],
    template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" *ngIf="isVisible">
      <div class="bg-white w-auto rounded-3xl max-w-xs sm:max-w-sm p-7 relative">
        <app-dismiss-button (close)="onClose()"></app-dismiss-button>
        <div class="flex items-center mb-4 flex-row">
          <span class="flex items-center justify-center" style="margin-right: 6px">
            <i [ngClass]="titleIcon"
               style="margin-top: 2px"
            ></i>
          </span>
          <h2 class="text-lg font-bold ml-0.5">{{ title }}</h2>
        </div>
        <p class="text-gray-700 mb-6 mt-6 text-sm" [innerHTML]="message"></p>
        <div class="flex justify-between">
          <button (click)="onClose()" class="hidden sm:block text-gray-950 underline font-bold hover:underline">Close
          </button>
          <button *ngIf="secondaryActionText" (click)="onConfirmTwo()"
                  class="bg-white border border-black text-black px-4 py-2 font-bold rounded-3xl hover:bg-gray-100">
            {{ secondaryActionText }}
          </button>
          <button *ngIf="primaryActionText" (click)="onConfirmOne()"
                  class="bg-black text-white px-4 py-2 font-bold rounded-3xl hover:bg-gray-800">
            {{ primaryActionText }}
          </button>
        </div>
      </div>
    </div>
  `
})
export class ActionModalComponent {
  @Input() isVisible: boolean = false;
  @Input() title: string = '';
  @Input() message: string = '';
  @Input() primaryActionText?: string;
  @Input() secondaryActionText?: string;
  @Input() titleIcon?: string;

  @Output() close = new EventEmitter<void>();
  @Output() primaryAction = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  onConfirmOne() {
    this.onClose();
    this.primaryAction.emit();
  }

  onConfirmTwo() {
    this.onClose();
    this.secondaryAction.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(_: KeyboardEvent) {
    if (this.isVisible) {
      this.onClose();
    }
  }
}
