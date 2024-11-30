import {Component, HostListener, Input, OnInit} from '@angular/core';
import {DrawerService} from './drawer.service';
import {NgClass, NgIf, NgTemplateOutlet} from "@angular/common";
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
        [ngClass]="{
      'bg-white relative': true,
      'w-screen h-screen': fullscreen,
      'rounded-lg shadow-lg w-full max-w-3xl': !fullscreen,
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
    DismissButtonComponent
  ]
})
export class PopupTemplateComponent implements OnInit {
  @Input() fullscreen = false;
  isVisible = false;
  content?: any;

  constructor(private drawerService: DrawerService) {
  }

  ngOnInit() {
    this.drawerService.drawerState$.subscribe((state) => {
      this.isVisible = state.visible;
      this.content = state.content;
    });
  }

  close() {
    this.drawerService.close();
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(_: KeyboardEvent) {
    if (this.isVisible) {
      this.close();
    }
  }
}
