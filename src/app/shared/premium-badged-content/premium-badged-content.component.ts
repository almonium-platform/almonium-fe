import {Component, Input} from '@angular/core';
import {NgIf, NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'custom-badged-content',
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
      <div *ngIf="display && badgeText" class="custom-badge-container custom-badge-label-container">
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
  @Input() badgePosition: { top?: string; right?: string; bottom?: string; left?: string } = {
    top: '-5px',
    right: '-5px',
  };

  // Get the parsed numeric value of badgeSize
  get badgeNumericSize(): number {
    return parseInt(this.badgeSize.replace('px', ''), 10) || 20; // Fallback to 20 if invalid
  }

  get badgeStyle() {
    return {
      width: this.badgeSize,
      height: this.badgeSize,
      position: 'absolute',
      top: this.badgePosition.top,
      right: this.badgePosition.right,
      bottom: this.badgePosition.bottom,
      left: this.badgePosition.left,
    };
  }
}
