import {Component, Input} from '@angular/core';
import {TuiAvatar} from "@taiga-ui/kit/components";
import {TuiSkeleton} from "@taiga-ui/kit/directives";
import {avatarImageUrl, avatarLetter, isDefaultAvatar} from './avatar-display';


@Component({
  selector: 'app-avatar',
  template: `
    <span [tuiAvatar]="letter"
      [size]="size"
      [tuiSkeleton]="loading"
      [style.background]="discBackground"
      [style.color]="premium ? 'var(--page-ground)' : 'var(--subhead-color)'"
      [style.font-size]="letterFontSize"
      [style.--t-size]="sizeInRem ? sizeInRem + 'rem' : null"
      class="cursor-pointer"
    >
      @if (displayAvatarUrl) {
        <img [src]="displayAvatarUrl" alt="" />
      }
    </span>
  `,
  imports: [
    TuiAvatar,
    TuiSkeleton
  ],
  styles: [`
    :host img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `],
})
export class AvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() username: string | null = null;
  @Input() premium = false;
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 'm';
  @Input() sizeInRem: number | null = null;
  @Input() loading = false;

  get letter(): string {
    return avatarLetter(this.username);
  }

  get displayAvatarUrl(): string | null {
    return avatarImageUrl(this.avatarUrl, this.premium);
  }

  get discBackground(): string | null {
    if (this.avatarUrl && !isDefaultAvatar(this.avatarUrl)) {
      return null;
    }

    return this.premium ? 'var(--premium-gradient)' : 'var(--control-border-color)';
  }

  get letterFontSize(): string {
    const sizeRem = this.sizeInRem ?? {
      xs: 1.5,
      s: 2,
      m: 2.5,
      l: 3,
      xl: 4,
      xxl: 5,
    }[this.size];

    return `${sizeRem * .55}rem`;
  }
}
