import {logger} from "../logger";
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {finalize, Observable} from 'rxjs';
import {TuiLoader} from "@taiga-ui/core/components";
import {SharedLucideIconsModule} from "../shared-lucide-icons.module";

@Component({
  selector: 'app-action-icon',
  template: `
    <button
      type="button"
      class="relative flex items-center justify-center cursor-pointer"
      [class.disabled]="disabled || loadingState"
      [disabled]="disabled || loadingState"
      (click)="onClick()"
    >
      @if (loadingState) {
        <tui-loader
          class="absolute loader"
        ></tui-loader>
      }

      @if (!loadingState) {
        <lucide-icon
          [name]="icon"
          [size]="size"
          [strokeWidth]="strokeWidth"
          [class.loading]="loadingState"
        ></lucide-icon>
      }
    </button>
  `,
  imports: [
    SharedLucideIconsModule,
    TuiLoader,
  ],
  styleUrls: ['./action-icon.component.less'],
})
export class ActionIconComponent {

  @Input() icon = ''; // Icon name
  @Input() size = 24; // Icon size
  @Input() loaderSize = 24; // Loader size for alignment
  @Input() strokeWidth = 1; // Icon stroke width
  @Input() disabled = false; // Whether the icon should be disabled
  @Input() action: () => Observable<unknown> = () => new Observable(); // Action to execute
  @Output() actionCompleted = new EventEmitter<void>(); // Emit when action finishes

  protected loadingState = false;

  onClick(): void {
    if (this.disabled || this.loadingState) {
      return;
    }

    // Trigger loading and execute action
    this.loadingState = true;
    this.action()
      .pipe(finalize(() => this.loadingState = false))
      .subscribe({
        next: () => {
          this.actionCompleted.emit(); // Notify parent of successful action
        },
        error: () => {
          logger.error('Action failed'); // Handle error if needed
        },
      });
  }
}
