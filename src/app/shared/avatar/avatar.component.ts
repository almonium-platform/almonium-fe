import {Component, Input} from '@angular/core';
import {TuiAvatar, TuiAvatarOutline} from "@taiga-ui/kit";


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
      >
      </tui-avatar>
    }

  `,
  imports: [
    TuiAvatar,
    TuiAvatarOutline
  ],
})
export class AvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() username: string | null = null;
  @Input() outline: boolean = false;
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'm';
  @Input() sizeInRem: number | null = null; // or calculate dynamically

  get initials(): string {
    return this.username
      ? this.username.slice(0, 2).toUpperCase()
      : '';
  }
}
