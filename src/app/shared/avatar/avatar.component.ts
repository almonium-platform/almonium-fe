import {Component, Input} from '@angular/core';
import {TuiAvatar, TuiAvatarOutline} from "@taiga-ui/kit";
import {RouterLink} from "@angular/router";


@Component({
  selector: 'app-avatar',
  template: `
    <!--    ugly hack but I can't make tuiAvatarOutline work dynamically-->
    @if (outline) {
      <tui-avatar
        [src]="avatarUrl || initials"
        [size]="size"
        [style.background]="!avatarUrl ? 'var(--default-avatar-gradient)' : null"
        [style.color]="'white'"
        tuiAvatarOutline="var(--premium-gradient)"
        [style.--t-size]="sizeInRem ? sizeInRem + 'rem' : null"
        [routerLink]="redirect ? userLink : null"
        class="cursor-pointer"
      >
      </tui-avatar>
    } @else {
      <tui-avatar
        [src]="avatarUrl || initials"
        [style.background]="!avatarUrl ? 'var(--default-avatar-gradient)' : null"
        [style.color]="'white'"
        [size]="size"
        tuiAvatarOutline="var(--default-avatar-gradient)"
        [style.--t-size]="sizeInRem ? sizeInRem + 'rem' : null"
        [routerLink]="redirect ? userLink : null"
        class="cursor-pointer"
      >
      </tui-avatar>
    }
  `,
  imports: [
    TuiAvatar,
    TuiAvatarOutline,
    RouterLink
  ],
})
export class AvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() username: string | null = null;
  @Input() outline: boolean = false;
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'm';
  @Input() sizeInRem: number | null = null; // or calculate dynamically
  @Input() redirect: boolean = true; // New input with default value

  get initials(): string {
    return this.username
      ? this.username.slice(0, 2).toUpperCase()
      : '';
  }

  get userLink(): string {
    return '/users/' + this.username;
  }
}
