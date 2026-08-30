import {Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges} from '@angular/core';
import {DismissButtonComponent} from "../elements/dismiss-button/dismiss-button.component";

@Component({
  selector: 'app-confirm-modal',
  imports: [
    DismissButtonComponent
  ],
  styleUrls: ['./confirm-modal.component.less'],
  template: `
    @if (isVisible) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,37,48,0.75)]"
        (pointerdown)="onBackdropPointerDown($event)"
      >
        <div
          [class.fade-slide-in]="isVisible"
          [class.fade-slide-out]="fadeOutAnimating"
          class="confirm-modal-surface rounded-3xl w-full max-w-xs sm:max-w-sm p-7 relative"
        >
          <app-dismiss-button (closed)="onClose()"/>
          <div class="flex items-center mb-4 flex-row">
            <span
              class="flex items-center justify-center" style="margin-right: 6px">
              <i
                class="fas fa-circle-exclamation text-xl text-red-500"
                style="margin-top: 1px"
              ></i>
            </span>
            <h2 class="text-xl font-bold ml-0.5">{{ title }}</h2>
          </div>
          <p class="confirm-modal-copy mb-6 mt-6 text-sm">{{ message }}</p>
          @if (confirmationWord) {
            <label class="confirm-modal-copy block text-sm mb-5">
              Type <strong>{{ confirmationWord }}</strong> to confirm
              <input
                type="text"
                class="confirmation-input"
                [value]="confirmationValue"
                (input)="confirmationValue = $any($event.target).value"
                [attr.aria-label]="'Type ' + confirmationWord + ' to confirm'"
                autocomplete="off"
              />
            </label>
          }
          <div class="flex justify-between">
            <button
              (click)="onClose()"
              class="confirm-modal-cancel underline font-bold hover:underline"
            >
              Cancel
            </button>
            <button
              (click)="onConfirm()"
              [disabled]="isButtonDisabled"
              class="bg-red-500 text-white px-4 py-2 font-bold rounded-3xl hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {{ isButtonDisabled ? 'Proceed in ' + countdown : confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmModalComponent implements OnChanges, OnDestroy {
  @Input() isVisible = false;
  @Input() title = '';
  @Input() message = '';
  @Input() confirmText = '';
  @Input() useCountdown = false;
  @Input() confirmationWord = '';

  @Output() closed = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  fadeOutAnimating = false;
  countdown = 5;
  countdownDisabled = true;
  confirmationValue = '';
  intervalId?: ReturnType<typeof setInterval>;
  closeTimeout?: ReturnType<typeof setTimeout>;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isVisible']?.currentValue === true) {
      this.confirmationValue = '';
      if (this.useCountdown) {
        this.resetCountdown();
      } else {
        this.countdownDisabled = false;
      }
    } else if (changes['isVisible']?.currentValue === false) {
      this.clearCountdown();
    }
  }

  resetCountdown() {
    this.clearCountdown();
    this.countdown = 5;
    this.countdownDisabled = true;

    this.intervalId = setInterval(() => {
      this.countdown--;

      if (this.countdown === 0) {
        this.countdownDisabled = false;
        this.clearCountdown();
      }
    }, 1000);
  }

  clearCountdown() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  get isButtonDisabled(): boolean {
    return this.countdownDisabled
      || (!!this.confirmationWord && this.confirmationValue !== this.confirmationWord);
  }

  onBackdropPointerDown(event: PointerEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose() {
    this.clearCountdown();
    this.fadeOutAnimating = true;
    clearTimeout(this.closeTimeout);
    this.closeTimeout = setTimeout(() => {
      this.closed.emit();
      this.fadeOutAnimating = false;
    }, 200); // Match animation duration in milliseconds
  }

  onConfirm() {
    this.confirm.emit();
    this.onClose();
  }

  ngOnDestroy() {
    this.clearCountdown();
    clearTimeout(this.closeTimeout);
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.isVisible) {
      this.onClose();
    }
  }
}
