import {Component, EventEmitter, HostListener, Input, Output} from '@angular/core';
import {NgClass} from "@angular/common";
import {DismissButtonComponent} from "../elements/dismiss-button/dismiss-button.component";

@Component({
  selector: 'app-action-modal',
  imports: [
    DismissButtonComponent,
    NgClass
  ],
  template: `
    @if (isVisible) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,37,48,0.50)]">
        <div class="bg-white w-auto rounded-3xl max-w-xs sm:max-w-sm p-7 relative motion-preset-slide-up-sm">
          <app-dismiss-button (closed)="onClose()"></app-dismiss-button>
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
            @if (secondaryActionText) {
              <button (click)="onConfirmTwo()"
                      class="bg-white border-[var(--brand-ink)] text-[var(--brand-ink)] px-4 py-2 font-bold rounded-3xl hover:bg-gray-100">
                {{ secondaryActionText }}
              </button>
            }
            @if (primaryActionText) {
              <button (click)="onConfirmOne()"
                      class="bg-[var(--brand-ink)] text-white px-4 py-2 font-bold rounded-3xl hover:bg-[var(--brand-pressed)]">
                {{ primaryActionText }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class ActionModalComponent {
  @Input() isVisible = false;
  @Input() title = '';
  @Input() message = '';
  @Input() primaryActionText?: string;
  @Input() secondaryActionText?: string;
  @Input() titleIcon?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() primaryAction = new EventEmitter<void>();
  @Output() secondaryAction = new EventEmitter<void>();

  onClose() {
    this.closed.emit();
  }

  onConfirmOne() {
    this.onClose();
    this.primaryAction.emit();
  }

  onConfirmTwo() {
    this.onClose();
    this.secondaryAction.emit();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.isVisible) {
      this.onClose();
    }
  }
}
