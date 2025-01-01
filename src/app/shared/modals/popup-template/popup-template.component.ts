import {Component, HostListener, Input, OnInit} from '@angular/core';
import {PopupTemplateStateService} from './popup-template-state.service';
import {NgClass, NgIf, NgStyle, NgTemplateOutlet} from "@angular/common";
import {DismissButtonComponent} from "../elements/dismiss-button/dismiss-button.component";

@Component({
  selector: 'app-popup-template',
  template: `
    <div
      *ngIf="isVisible"
      [ngClass]="{
    'fixed inset-0 z-50 bg-black bg-opacity-75 flex': true,
    'flex-col': fullscreen,
    'items-center justify-center': !fullscreen,
  }"
    >
      <div
        [ngStyle]="{'background-color': backgroundColor}"
        [ngClass]="{
      'bg-white relative': true,
      'w-screen h-screen': fullscreen,
      'rounded-2xl shadow-lg w-full max-w-3xl': !fullscreen,
      'motion-preset-slide-up': !fullscreen,
    }"
      >
        <app-dismiss-button (close)="close()"></app-dismiss-button>
        <ng-container *ngIf="content">
          <ng-container *ngTemplateOutlet="content"></ng-container>
        </ng-container>
      </div>
    </div>
  `,
  imports: [
    NgIf,
    NgTemplateOutlet,
    NgClass,
    DismissButtonComponent,
    NgStyle
  ]
})
export class PopupTemplateComponent implements OnInit {
  @Input() fullscreen = false;
  isVisible = false;
  content?: any;
  backgroundColor: string = 'var(--gray-bg)';

  constructor(private popupTemplateStateService: PopupTemplateStateService) {
  }

  ngOnInit() {
    this.popupTemplateStateService.drawerState$.subscribe((state) => {
      this.isVisible = state.visible;
      this.content = state.content;
    });
  }

  close() {
    this.popupTemplateStateService.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(_: KeyboardEvent) {
    if (this.isVisible) {
      this.close();
    }
  }
}
