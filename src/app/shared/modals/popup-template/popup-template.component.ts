import {Component, HostListener, Input, OnDestroy, OnInit} from '@angular/core';
import {DrawerState, PopupTemplateStateService} from './popup-template-state.service';
import {NgClass, NgTemplateOutlet} from "@angular/common";
import {DismissButtonComponent} from "../elements/dismiss-button/dismiss-button.component";
import {NgClickOutsideDirective} from "ng-click-outside2";
import {Subject, takeUntil} from "rxjs";

@Component({
  selector: 'app-popup-template',
  template: `
    @if (drawerState.visible) {
      <div
        [ngClass]="{
        'fixed inset-0 z-50 flex bg-overlay': true,
        'flex-col': fullscreen,
        'items-center justify-center': !fullscreen
      }"
        [class.bg-darkening]="drawerState.visible && !drawerState.closing"
        [class.bg-lightening]="drawerState.closing"
      >
        <div
          class="relative"
          [ngClass]="{
          'w-screen h-screen': fullscreen,
          'embedded': !fullscreen,
          'slide-down': drawerState.closing
        }"
          (clickOutside)="onClickOutside()"
        >
          <app-dismiss-button
            (close)="close()"
            [isOutside]="drawerState.outside"
          ></app-dismiss-button>
          <!-- Render the content if we have it -->
          @if (drawerState.content) {
            <ng-container *ngTemplateOutlet="drawerState.content">
            </ng-container>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .embedded {
      @apply rounded-2xl w-fit shadow-lg motion-preset-slide-up;
        max-width: min(48rem, 95%);
      }

      .bg-overlay {
        background-color: rgba(0, 0, 0, 0); /* Initial transparent state */
        transition: background-color 0.4s ease;
      }

      .bg-darkening {
        animation: fadeInBackground 0.4s forwards ease-in-out;
      }

      .bg-lightening {
        animation: fadeOutBackground 0.4s forwards ease-in-out;
      }

      @keyframes fadeInBackground {
        from {
          background-color: rgba(0, 0, 0, 0);
        }
        to {
          background-color: rgba(0, 0, 0, 0.80); /* Final dark state */
        }
      }

      @keyframes fadeOutBackground {
        from {
          background-color: rgba(0, 0, 0, 0.80);
        }
        to {
          background-color: rgba(0, 0, 0, 0); /* Back to transparent */
        }
      }

      .slide-down {
        animation: slideDown 0.5s ease-in-out forwards;
      }

      @keyframes slideDown {
        to {
          transform: translateY(100%);
          opacity: 0;
        }
        from {
          transform: translateY(0%);
          opacity: 1;
        }
      }
    `,
  ],
  imports: [
    NgTemplateOutlet,
    NgClass,
    DismissButtonComponent,
    NgClickOutsideDirective
  ],
})
export class PopupTemplateComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  @Input() fullscreen = false;
  drawerState!: DrawerState;
  private ignoreClicks = true;

  constructor(private popupTemplateStateService: PopupTemplateStateService) {
  }

  ngOnInit() {
    this.popupTemplateStateService.drawerState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.drawerState = state;

        // Enable clicks only after a delay (e.g., 300ms) when the popup opens
        if (state.visible) {
          this.ignoreClicks = true;
          setTimeout(() => {
            this.ignoreClicks = false;
          }, 300); // Match this with your opening animation duration
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close() {
    this.popupTemplateStateService.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(_: KeyboardEvent) {
    if (this.drawerState.visible) {
      this.close();
    }
  }

  onClickOutside() {
    if (this.drawerState.visible && !this.ignoreClicks) {
      this.close();
    }
  }
}
