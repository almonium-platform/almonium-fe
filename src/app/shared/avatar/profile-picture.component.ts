import {Component, Input} from '@angular/core';
import {NgIf, NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'app-profile-picture',
  template: `
    <ng-container *ngIf="avatarUrl; else gradientBackground">
      <img
        [ngSrc]="avatarUrl || ''"
        [alt]="altText"
        [class]="circleClass"
        [width]="width"
        [height]="height"
      />
    </ng-container>
    <ng-template #gradientBackground>
      <div [class]="circleClass + ' ' + gradientClass"></div>
    </ng-template>
  `,
  imports: [
    NgOptimizedImage,
    NgIf
  ],
})
export class ProfilePictureComponent {
  @Input() avatarUrl: string | null = null;
  @Input() altText: string = 'User Avatar';
  @Input() circleClass: string = 'profile-circle';
  @Input() gradientClass: string = 'bg-gradient-to-bl from-purple-500 to-pink-500';
  @Input() width: number = 40;
  @Input() height: number = 40;
}
