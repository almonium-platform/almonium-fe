import {Component, Input} from '@angular/core';
import {AvatarComponent} from "../avatar.component";
import {UserPreviewCardComponent} from "../../user-preview-card/user-preview-card.component";
import {TuiDropdownDirective, TuiDropdownManual} from "@taiga-ui/core";
import {LucideAngularModule} from "lucide-angular";


@Component({
  selector: 'app-avatar-preview',
  template: `
    <app-avatar
      [avatarUrl]="avatarUrl"
      [username]="username"
      [outline]="outline"
      [size]="size"
      [sizeInRem]="sizeInRem"
      [redirect]="redirect"
      [loading]="loading"
      [tuiDropdownManual]="showDropdown()"
      [tuiDropdown]="dropdownTemplate"
      (mouseenter)="onHover()"
      (mouseleave)="onLeave()"
      class="flex"
    >
    </app-avatar>
    <ng-template #dropdownTemplate>
      @if (userId) {
        <app-user-preview-card
          [userId]="userId"
          (mouseenter)="dropdownOnHover()"
          (mouseleave)="cardHovered = false"
          (close)="onLeave()"
        ></app-user-preview-card>
      }
    </ng-template>
  `,
  imports: [
    AvatarComponent,
    UserPreviewCardComponent,
    TuiDropdownDirective,
    TuiDropdownManual,
    LucideAngularModule
  ],
})
export class AvatarPreviewComponent {
  @Input() avatarUrl: string | null = null;
  @Input() username: string | null = null;
  @Input() outline: boolean = false; // todo: rename to premium
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'm';
  @Input() sizeInRem: number | null = null;
  @Input() redirect: boolean = false;
  @Input() loading: boolean = false;
  @Input() userId: string | null = null;
  protected previewOpened: boolean = false;
  protected cardHovered: boolean = false;

  onHover() {
    this.previewOpened = true;
  }

  timeout: any;

  onLeave() {
    this.timeout = setTimeout(() => {
      if (!this.cardHovered) {
        this.previewOpened = false;
      }
    }, 200);
  }

  showDropdown() {
    return !!this.userId && this.previewOpened;
  }

  dropdownOnHover() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.cardHovered = true;
  }
}
