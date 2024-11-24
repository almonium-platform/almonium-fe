import {Component, Input} from '@angular/core';
import {NgIf, NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'premium-badged-content',
  template: `
    <div class="custom-badged-content">
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
    NgOptimizedImage
  ],
  standalone: true
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

  // Get the parsed numeric value of badgeSize
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
}
