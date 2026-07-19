import { Component, Input, ViewChild, inject } from '@angular/core';
import {NgOptimizedImage} from "@angular/common";
import {PaywallComponent} from "../paywall/paywall.component";
import {PopupTemplateStateService} from "../modals/popup-template/popup-template-state.service";

@Component({
  selector: 'app-premium-badged-content',
  template: `
    <app-paywall #paywallComponent></app-paywall>

    <div class="custom-badged-content" tabindex="0" (keydown.enter)="handleClick($event)" (click)="handleClick($event)">
      <ng-content></ng-content>
      <!-- Badge Icon at Top-Right -->
      @if (display) {
        <div class="custom-badge-container custom-badge-icon-container">
          @if (showIcon) {
            <div class="custom-badge-icon" [style]="badgeStyle">
              <img [ngSrc]="badgeIconSrc"
                   [alt]="badgeAltText"
                   [width]="badgeNumericSize"
                   [height]="badgeNumericSize"
              />
            </div>
          }
        </div>
      }
      <!-- Badge Label at Bottom Center -->
      @if (display && badgeText) {
        <div class="custom-badge-container custom-badge-label-container"
             [style]="labelPosition">
          <div class="custom-badge-text">
            {{ badgeText }}
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./premium-badged-content.component.less'],
  imports: [
    NgOptimizedImage,
    PaywallComponent
  ]
})
export class PremiumBadgedContentComponent {
  private popupTemplateStateService = inject(PopupTemplateStateService);

  @Input() display = true; // Whether the badge is displayed
  @Input() showIcon = true; // Whether the icon is displayed
  @Input() badgeIconSrc = ''; // Badge icon source
  @Input() badgeAltText = 'badge'; // Alt text for the badge
  @Input() badgeSize = '20px'; // Size of the badge
  @Input() badgeText: string | null = null; // Optional text for the badge
  @Input() iconPosition: { top?: string; right?: string; bottom?: string; left?: string } = {
    top: '-5px',
    right: '-5px',
  };
  @Input() labelPosition: { top?: string; right?: string; bottom?: string; left?: string } = {};

  // paywall dialog
  @Input() originalClickHandler: (() => void) | null = null; // Original logic when not paywalled
  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;

  get badgeNumericSize(): number {
    return parseInt(this.badgeSize.replace('px', ''), 10) || 20; // Fallback to 20 if invalid
  }

  get badgeStyle() {
    return {
      width: this.badgeSize,
      height: this.badgeSize,
      position: 'absolute',
      top: this.iconPosition.top,
      right: this.iconPosition.right,
      bottom: this.iconPosition.bottom,
      left: this.iconPosition.left,
    };
  }

  handleClick(event: Event): void {
    event.stopPropagation();

    if (this.display) {
      this.popupTemplateStateService.open(this.paywallComponent.content, 'paywall');
    } else if (this.originalClickHandler) {
      this.originalClickHandler();
    }
  }
}
