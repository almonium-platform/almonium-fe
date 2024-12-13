import {Component, Input} from '@angular/core';
import {NgIf} from "@angular/common";

@Component({
  selector: 'app-profile-picture',
  template: `
    <div
      class="profile-circle"
      [style.width.px]="size"
      [style.height.px]="size"
    >
      <img
        *ngIf="avatarUrl"
        [src]="avatarUrl"
        [alt]="'Profile picture'"
        class="profile-image"
      />
      <div
        *ngIf="!avatarUrl"
        [class]="gradientClass"
        class="profile-image"
      ></div>
    </div>

  `,
  styles: [`
    .profile-circle {
      box-shadow: var(--box-shadow);
      border-radius: 50%; /* Ensures circular shape */
      overflow: hidden; /* Ensures child elements don't overlap */
      position: relative; /* Ensures contained elements respect the boundaries */
    }

    .profile-image {
      width: 100%; /* Fill the parent container */
      height: 100%;
      object-fit: cover; /* Ensures the image is properly cropped */
      border-radius: 50%; /* Ensures the image follows the circle shape */
    }
  `
  ],
  imports: [
    NgIf
  ],
})
export class ProfilePictureComponent {
  @Input() avatarUrl: string | null = null;
  @Input() size: number = 40;
  @Input() gradientClass: string = 'bg-gradient-to-bl from-purple-500 to-pink-500';
}
