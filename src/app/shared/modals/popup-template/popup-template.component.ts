import { Component, HostListener, Input, OnDestroy, OnInit, inject } from '@angular/core';
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
        'overlay-scroll overlay-inset': !fullscreen,
        'overlay-inset-roomy': !fullscreen && drawerState.closeBtnOutside
      }"
        [class.bg-darkening]="drawerState.visible && !drawerState.closing"
        [class.bg-lightening]="drawerState.closing"
      >
        <div
          class="relative"
          [ngClass]="{
          'w-screen h-screen': fullscreen,
          'embedded': !fullscreen,
          'motion-preset-slide-up': !fullscreen,
          'slide-down': drawerState.closing
        }"
          (clickOutside)="onClickOutside()"
        >
          <app-dismiss-button
            (closed)="close()"
            [isOutside]="drawerState.closeBtnOutside"
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
      /* Room for the dialog to breathe without spending height a tall dialog needs. */
      .overlay-inset {
        padding: 1.25rem;
      }

      /* The close button that hangs outside the shell needs its corner kept on screen. */
      .overlay-inset-roomy {
        padding: 2.75rem;
      }

      /* A dialog taller than the viewport is scrolled by the overlay, not by a box inside the
         card: the scrollbar then rides the backdrop instead of carving a gutter out of the
         content. Centring is done with auto margins, which give way under overflow where
         align-items: center would crop the top. */
      .overlay-scroll {
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        scrollbar-color: rgba(250, 246, 248, 0.32) transparent;
      }

      .embedded {
        margin: auto;
        border-radius: 1rem;
        width: fit-content;
        box-shadow: 0 10px 15px -3px rgba(44, 37, 48, 0.1), 0 4px 6px -4px rgba(44, 37, 48, 0.1);
        max-width: min(48rem, 95%);
      }

      .bg-overlay {
          background-color: transparent; /* Initial transparent state */
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
          background-color: transparent;
        }
        to {
          background-color: rgba(44, 37, 48, 0.80); /* Final dark state */
        }
      }

      @keyframes fadeOutBackground {
        from {
          background-color: rgba(44, 37, 48, 0.80);
        }
        to {
          background-color: transparent; /* Back to transparent */
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
  private popupTemplateStateService = inject(PopupTemplateStateService);

  private readonly destroy$ = new Subject<void>();
  @Input() fullscreen = false;
  drawerState!: DrawerState;
  private ignoreClicks = true;

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

  @HostListener('document:keydown.escape')
  handleEscapeKey() {
    if (this.drawerState.visible) {
      this.close();
    }
  }

  onClickOutside() {
    if (this.drawerState.doNotTrackOutsideClick) return;

    if (this.drawerState.visible && !this.ignoreClicks) {
      this.close();
    }
  }
}
