import {Component, Input} from '@angular/core';
import {TuiAvatar, TuiSkeleton} from "@taiga-ui/kit";


@Component({
  selector: 'app-avatar',
  template: `
    <tui-avatar
      [src]="avatarUrl || initials"
      [size]="size"
      [tuiSkeleton]="loading"
      [style.background]="!avatarUrl ? 'var(--default-avatar-gradient)' : null"
      [style.color]="'white'"
      [style.--t-size]="sizeInRem ? sizeInRem + 'rem' : null"
      class="cursor-pointer"
    >
    </tui-avatar>
  `,
  imports: [
    TuiAvatar,
    TuiSkeleton
  ],
})
export class AvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() username: string | null = null;
  @Input() outline: boolean = false; // todo: rename to premium. remove? Not used anymore.
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'm';
  @Input() sizeInRem: number | null = null;
  @Input() loading: boolean = false;

  get initials(): string {
    return this.username
      ? this.username.slice(0, 2).toUpperCase()
      : '';
  }
}
