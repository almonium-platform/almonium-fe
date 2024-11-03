import {Component, EventEmitter, HostListener, Input, Output} from '@angular/core';
import {NgIf, NgOptimizedImage} from "@angular/common";
import {DismissButtonComponent} from "../elements/dismiss-button/dismiss-button.component";

@Component({
  selector: 'app-action-modal',
  standalone: true,
  imports: [
    NgIf,
    NgOptimizedImage,
    DismissButtonComponent
  ],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" *ngIf="isVisible">
      <div class="bg-white rounded-3xl w-full max-w-xs sm:max-w-sm p-7 relative">
        <app-dismiss-button (close)="onClose()"></app-dismiss-button>
        <div class="flex items-center mb-4 flex-row">
          <span class="flex items-center justify-center" style="margin-right: 6px">
            <i class="fi fi-rr-email-pending text-xl"
               style="margin-top: 3px"
            ></i>
          </span>
          <h2 class="text-lg font-bold ml-0.5">{{ title }}</h2>
        </div>
        <p class="text-gray-700 mb-6 mt-6 text-sm" [innerHTML]="message"></p>
        <div class="flex justify-between">
          <button (click)="onClose()" class="hidden sm:block text-gray-950 underline font-bold hover:underline">Close</button>
          <button (click)="onConfirmTwo()"
                  class="bg-white border border-black text-black px-4 py-2 font-bold rounded-3xl hover:bg-gray-100">
            {{ actionTwoText }}
          </button>
          <button (click)="onConfirmOne()"
                  class="bg-black text-white px-4 py-2 font-bold rounded-3xl hover:bg-gray-800">
            {{ actionOneText }}
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
  @Input() actionOneText: string = '';
  @Input() actionTwoText: string = '';

  @Output() close = new EventEmitter<void>();
  @Output() actionOne = new EventEmitter<void>();
  @Output() actionTwo = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  onConfirmOne() {
    this.onClose();
    this.actionOne.emit();
  }

  onConfirmTwo() {
    this.onClose();
    this.actionTwo.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(_: KeyboardEvent) {
    if (this.isVisible) {
      this.onClose();
    }
  }
}
