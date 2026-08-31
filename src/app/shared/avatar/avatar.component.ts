import {Component, HostBinding, Input} from '@angular/core';
import {TuiAvatar} from "@taiga-ui/kit/components";
import {TuiSkeleton} from "@taiga-ui/kit/directives";
import {avatarImageUrl, avatarLetter, isDefaultAvatar} from './avatar-display';


@Component({
  selector: 'app-avatar',
  template: `
    <span [tuiAvatar]="displayAvatarUrl ? null : letter"
      [size]="size"
      [tuiSkeleton]="loading"
      [style.background]="discBackground"
      [style.font-size]="letterFontSize"
      [style.--t-size]="sizeInRem ? sizeInRem + 'rem' : null"
      [class.premium-letter]="premium && !avatarUrl"
      class="cursor-pointer avatar-disc"
    >
      @if (premiumDefaultAvatar) {
        <span class="premium-artwork" [style.mask-image]="artworkMask" [style.-webkit-mask-image]="artworkMask"></span>
      } @else if (displayAvatarUrl) {
        <img [src]="displayAvatarUrl" alt="" />
      }
    </span>
  `,
  imports: [
    TuiAvatar,
    TuiSkeleton
  ],
  styles: [`
    :host [tuiAvatar]._initials::before {
      font: inherit;
    }

    :host img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    :host .premium-artwork {
      width: 100%;
      height: 100%;
      background: var(--premium-gradient);
      mask-position: center;
      mask-repeat: no-repeat;
      mask-size: contain;
      -webkit-mask-position: center;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-size: contain;
    }

    :host .premium-letter {
      color: transparent;
    }

    :host .premium-letter::before {
      background: var(--premium-gradient);
      background-clip: text;
      color: transparent;
      -webkit-background-clip: text;
    }

    /* Tier beside other people is a ring, not a star. Never on your own profile, where the plan card says it. */
    :host(.premium-ring) {
      position: relative;
      display: inline-grid;
      padding: 3px;
      border-radius: 50%;
      background: var(--premium-gradient);
    }

    :host(.premium-ring)::before {
      position: absolute;
      background: var(--avatar-ring-gap, var(--card-color));
      border-radius: 50%;
      content: '';
      inset: 2px;
    }

    :host(.premium-ring) .avatar-disc {
      position: relative;
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
  /** Draw the member ring. Only where someone else is looking — a people list, a profile card. */
  @Input() ring = false;

  @HostBinding('class.premium-ring')
  get memberRing(): boolean {
    return this.ring && this.premium;
  }

  get letter(): string {
    return avatarLetter(this.username);
  }

  get displayAvatarUrl(): string | null {
    return avatarImageUrl(this.avatarUrl);
  }

  get premiumDefaultAvatar(): boolean {
    return this.premium && isDefaultAvatar(this.avatarUrl);
  }

  get artworkMask(): string | null {
    return this.avatarUrl ? `url("${this.avatarUrl}")` : null;
  }

  get discBackground(): string | null {
    if (this.avatarUrl && !isDefaultAvatar(this.avatarUrl)) {
      return null;
    }

    return 'var(--avatar-ground)';
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
