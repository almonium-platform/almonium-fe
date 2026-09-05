import {Component, HostBinding, Input} from '@angular/core';
import {TuiAvatar} from "@taiga-ui/kit/components";
import {TuiSkeleton} from "@taiga-ui/kit/directives";
import {avatarHueToken, avatarImageUrl, avatarLetter, isDefaultAvatar} from './avatar-display';


@Component({
  selector: 'app-avatar',
  template: `
    <span [tuiAvatar]="displayAvatarUrl ? null : letter"
      [size]="size"
      [tuiSkeleton]="loading"
      [style.background]="discBackground"
      [style.color]="discInk"
      [style.box-shadow]="discRing"
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
    /* The mark is the first letter of the username in Literata 600, per the type scale --
       the disc otherwise inherits the UI sans and the letter reads as a label, not a mark. */
    :host .avatar-disc {
      font-family: var(--font-family-reading);
      font-weight: 600;
      line-height: 1;
    }

    /* Taiga's own [data-size=*]._initials rule sets the font, so the disc's own class
       has to be in the selector for the inherited Literata and inline size to win. */
    :host [tuiAvatar]._initials.avatar-disc::before {
      font: inherit;
      letter-spacing: normal;
      /* Taiga centres the line box, so the mark sits on a baseline set by the whole em -
         Literata's descender included. A capital has no descender, so it hangs low by half
         of one: lift it back onto the disc's optical centre. */
      transform: translateY(-.06em);
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

    /* Tier is the gradient on the ink, the same rule the animals follow: pale ground, gradient
       letterform. Specificity matches the Taiga initials rule so the fill is not overridden. */
    :host .premium-letter {
      color: transparent;
    }

    :host [tuiAvatar]._initials.premium-letter::before {
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
  /**
   * 28c: take the hashed identity hue instead of the plain ground. Opt-in, and only from a
   * surface that draws several avatars at once and needs the tint to sort them - a chat list, a
   * People panel, a member list. One avatar on screen has nothing to be told apart from.
   */
  @Input() hashed = false;

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

  /**
   * The bundled artwork is dark line work on transparency, so it needs its plate. A letter sits
   * on the plain ground unless the caller asked for the hashed identity, and the tier never
   * moves it: premium is the gradient on the ink, the same rule the artwork follows. An
   * uploaded photo is opaque and covers the disc, so it gets nothing.
   *
   * Taiga paints the disc from its own rule at the same specificity, so these have to be
   * inline styles rather than the `.avatar-ground` / `.avatar-hue-*` classes used elsewhere.
   */
  get discBackground(): string | null {
    if (!this.avatarUrl) {
      return this.hashed ? avatarHueToken(this.username, 'fill') : 'var(--avatar-ground)';
    }

    return isDefaultAvatar(this.avatarUrl) ? 'var(--avatar-plate)' : null;
  }

  /** A member's letter is filled by the gradient in `.premium-letter`, so it takes no ink here. */
  get discInk(): string | null {
    if (this.avatarUrl || this.premium) {
      return null;
    }

    return this.hashed ? 'var(--avatar-hue-ink)' : 'var(--avatar-ground-ink)';
  }

  /**
   * The plate is seated from outside, because it is a light card on a dark ground. A letter disc
   * is a tint of its own theme and only needs an edge, which light draws and dark leaves clear.
   */
  get discRing(): string | null {
    if (!this.avatarUrl) {
      return this.hashed
        ? `inset 0 0 0 1px ${avatarHueToken(this.username, 'edge')}`
        : 'inset 0 0 0 1px var(--avatar-ground-edge)';
    }

    return isDefaultAvatar(this.avatarUrl) ? '0 0 0 1px var(--avatar-plate-ring)' : null;
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

    return `${sizeRem * .46}rem`;
  }
}
