import {Component, HostListener, Input, OnInit} from '@angular/core';
import {DrawerState, PopupTemplateStateService} from './popup-template-state.service';
import {NgClass, NgIf, NgTemplateOutlet} from "@angular/common";
import {DismissButtonComponent} from "../elements/dismiss-button/dismiss-button.component";

@Component({
  selector: 'app-popup-template',
  template: `
    <div
      *ngIf="drawerState.visible"
      [ngClass]="{
        'fixed inset-0 z-50 bg-black bg-opacity-75 flex': true,
        'flex-col': fullscreen,
        'items-center justify-center': !fullscreen
      }"
    >
      <div
        class="relative"
        [ngClass]="{
          'w-screen h-screen': fullscreen,
          'rounded-2xl w-fit shadow-lg max-w-3xl motion-preset-slide-up': !fullscreen,
          'slide-down': drawerState.closing
        }"
      >
        <app-dismiss-button
          (close)="close()"
          [isOutside]="drawerState.outside"
        ></app-dismiss-button>

        <!-- Render the content if we have it -->
        <ng-container *ngIf="drawerState.content">
          <ng-container *ngTemplateOutlet="drawerState.content">
          </ng-container>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
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
  `],
  imports: [
    NgIf,
    NgTemplateOutlet,
    NgClass,
    DismissButtonComponent,
  ]
})
export class PopupTemplateComponent implements OnInit {
  @Input() fullscreen = false;
  drawerState!: DrawerState;

  constructor(private popupTemplateStateService: PopupTemplateStateService) {
  }

  ngOnInit() {
    this.popupTemplateStateService.drawerState$.subscribe(state => {
      this.drawerState = state;
    });
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
}
