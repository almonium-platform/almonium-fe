import {Component, Input, ViewChild} from '@angular/core';
import {NgIf, NgOptimizedImage} from "@angular/common";
import {PaywallComponent} from "../paywall/paywall.component";
import {PopupTemplateStateService} from "../modals/popup-template/popup-template-state.service";

@Component({
  selector: 'premium-badged-content',
  template: `
    <paywall #paywallComponent></paywall>

    <div class="custom-badged-content" (click)="handleClick($event)">
      <ng-content></ng-content>
      <!-- Badge Icon at Top-Right -->
      <div *ngIf="display" class="custom-badge-container custom-badge-icon-container">
        <div *ngIf="showIcon" class="custom-badge-icon" [style]="badgeStyle">
          <img [ngSrc]="badgeIconSrc"
               [alt]="badgeAltText"
               [width]="badgeNumericSize"
               [height]="badgeNumericSize"
          />
        </div>
      </div>
      <!-- Badge Label at Bottom Center -->
      <div *ngIf="display && badgeText" class="custom-badge-container custom-badge-label-container"
           [style]="labelPosition">
        <div class="custom-badge-text">
          {{ badgeText }}
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./premium-badged-content.component.less'],
  imports: [
    NgIf,
    NgOptimizedImage,
    PaywallComponent
  ]
})
export class PremiumBadgedContentComponent {
  @Input() display: boolean = true; // Whether the badge is displayed
  @Input() showIcon: boolean = true; // Whether the icon is displayed
  @Input() badgeIconSrc: string = ''; // Badge icon source
  @Input() badgeAltText: string = 'badge'; // Alt text for the badge
  @Input() badgeSize: string = '20px'; // Size of the badge
  @Input() badgeText: string | null = null; // Optional text for the badge
  @Input() iconPosition: { top?: string; right?: string; bottom?: string; left?: string } = {
    top: '-5px',
    right: '-5px',
  };
  @Input() labelPosition: { top?: string; right?: string; bottom?: string; left?: string } = {};

  // paywall dialog
  @Input() originalClickHandler: (() => void) | null = null; // Original logic when not paywalled
  @ViewChild(PaywallComponent, {static: true}) paywallComponent!: PaywallComponent;

  constructor(private popupTemplateStateService: PopupTemplateStateService) {
  }

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

  handleClick(event: MouseEvent): void {
    event.stopPropagation();

    if (this.display) {
      this.popupTemplateStateService.open(this.paywallComponent.content);
    } else if (this.originalClickHandler) {
      this.originalClickHandler();
    }
  }
}
