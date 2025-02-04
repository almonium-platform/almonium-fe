import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {BehaviorSubject, finalize, Observable} from 'rxjs';
import {TuiLoader} from "@taiga-ui/core";
import {SharedLucideIconsModule} from "../shared-lucide-icons.module";

@Component({
  selector: 'app-action-icon',
  template: `
    <div
      class="relative flex items-center justify-center cursor-pointer"
      [class.disabled]="disabled || loadingState"
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
    </div>
  `,
  imports: [
    SharedLucideIconsModule,
    TuiLoader,
  ],
  styleUrls: ['./action-icon.component.less'],
})
export class ActionIconComponent implements OnInit {
  // todo delete unused?
  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  @Input() icon: string = ''; // Icon name
  @Input() size: number = 24; // Icon size
  @Input() loaderSize: number = 24; // Loader size for alignment
  @Input() strokeWidth: number = 1; // Icon stroke width
  @Input() disabled: boolean = false; // Whether the icon should be disabled
  @Input() action: () => Observable<any> = () => new Observable(); // Action to execute
  @Output() actionCompleted = new EventEmitter<void>(); // Emit when action finishes

  protected loadingState: boolean = false;

  ngOnInit() {
    this.loading$.subscribe((loading) => {
      this.loadingState = loading;
    });
  }

  onClick(): void {
    if (this.disabled || this.loadingState) {
      return;
    }

    // Trigger loading and execute action
    this.loadingSubject$.next(true);
    this.action()
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.actionCompleted.emit(); // Notify parent of successful action
        },
        error: () => {
          console.error('Action failed'); // Handle error if needed
        },
      });
  }
}
