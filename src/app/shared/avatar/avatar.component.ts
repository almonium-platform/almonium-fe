import {Component, Input} from '@angular/core';
import {TuiAvatar, TuiAvatarOutline, TuiSkeleton} from "@taiga-ui/kit";


@Component({
  selector: 'app-avatar',
  template: `
    <!--    ugly hack but I can't make tuiAvatarOutline work dynamically-->
    @if (outline) {
      <tui-avatar
        [src]="avatarUrl || initials"
        [size]="size"
        [tuiSkeleton]="loading"
        [style.background]="!avatarUrl ? 'var(--default-avatar-gradient)' : null"
        [style.color]="'white'"
        tuiAvatarOutline="var(--premium-gradient)"
        [style.--t-size]="sizeInRem ? sizeInRem + 'rem' : null"
        class="cursor-pointer"
      >
      </tui-avatar>
    } @else {
      <tui-avatar
        [src]="avatarUrl || initials"
        [style.background]="!avatarUrl ? 'var(--default-avatar-gradient)' : null"
        [style.color]="'white'"
        [size]="size"
        [tuiSkeleton]="loading"
        tuiAvatarOutline="var(--default-avatar-gradient)"
        [style.--t-size]="sizeInRem ? sizeInRem + 'rem' : null"
        class="cursor-pointer"
      >
      </tui-avatar>
    }
  `,
  styles: [`
    tui-avatar {
      ::ng-deep img {
        padding: 4px;
      }
    }
  `],
  imports: [
    TuiAvatar,
    TuiAvatarOutline,
    TuiSkeleton
  ],
})
export class AvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() username: string | null = null;
  @Input() outline: boolean = false; // todo: rename to premium
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'm';
  @Input() sizeInRem: number | null = null;
  @Input() loading: boolean = false;

  get initials(): string {
    return this.username
      ? this.username.slice(0, 2).toUpperCase()
      : '';
  }
}
