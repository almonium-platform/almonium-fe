import {Component, HostBinding, Input} from '@angular/core';
import {TuiAvatar} from "@taiga-ui/kit/components";
import {TuiSkeleton} from "@taiga-ui/kit/directives";
import {PremiumStarComponent} from '../premium-star/premium-star.component';
import {avatarHueToken, avatarImageUrl, avatarLetter, isDefaultAvatar, schematicAvatarUrl, usesSchematic} from './avatar-display';

/** The disc each Taiga size draws, in rem; `sizeInRem` overrides it. */
const SIZE_REM = {xs: 1.5, s: 2, m: 2.5, l: 3, xl: 4, xxl: 5} as const;


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
      @if (schematicUrl; as schematic) {
        @if (premium) {
          <span class="premium-artwork avatar-schematic" [style.mask-image]="mask(schematic)" [style.-webkit-mask-image]="mask(schematic)"></span>
        } @else {
          <img class="avatar-schematic" [src]="schematic" alt="" />
        }
      } @else if (premiumDefaultAvatar) {
        <span class="premium-artwork" [style.mask-image]="artworkMask" [style.-webkit-mask-image]="artworkMask"></span>
      } @else if (displayAvatarUrl) {
        <img [src]="displayAvatarUrl" alt="" />
      }
    </span>

    @if (memberStar) {
      <app-premium-star class="corner-star" label="Premium member" />
    }
  `,
  imports: [
    TuiAvatar,
    TuiSkeleton,
    PremiumStarComponent
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

    /* 30: the schematic is a 64-box line drawing, so it runs at 60% of the disc - the Taiga
       padding is not part of that disc. Taiga pins any image in the disc to its top-left corner
       and stretches it to fill, so a smaller one has to be seated in the middle by hand. */
    :host .avatar-schematic {
      position: absolute;
      inset: 0;
      margin: auto;
      inline-size: calc(var(--t-size) * .6);
      block-size: calc(var(--t-size) * .6);
      object-fit: contain;
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

    /*
     * Tier beside other people is the star, never a ring: a gradient ring around a disc is the
     * most-learned avatar gesture there is and it means "unseen story", not "member".
     *
     * On an avatar the star is seated in the corner, and only where the disc is large enough to
     * spare one - the profile card's 96px. Anywhere a name is printed the star follows the name
     * instead, and no card carries both. Never on your own avatar, where the plan card says it.
     */
    :host(.premium-star-host) {
      position: relative;
      display: inline-grid;
    }

    :host .corner-star {
      --premium-star-size: 1.75rem;
      --premium-star-glyph: .875rem;
      /* The keyline is the surface behind the avatar, so the star reads as sitting on top of it. */
      --premium-star-keyline: 0 0 0 2px var(--avatar-star-keyline, var(--card-color));

      position: absolute;
      right: -.125rem;
      bottom: -.125rem;
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
  /**
   * Seat the member star in the avatar's corner. Only on a disc large enough to hold it - the
   * profile card - and only where no name is printed beside it to carry the star instead.
   */
  @Input() star = false;
  /**
   * 28c: take the hashed identity hue instead of the plain ground. Opt-in, and only from a
   * surface that draws several avatars at once and needs the tint to sort them - a chat list, a
   * People panel, a member list. One avatar on screen has nothing to be told apart from.
   */
  @Input() hashed = false;

  @HostBinding('class.premium-star-host')
  get memberStar(): boolean {
    return this.star && this.premium;
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
    return this.avatarUrl ? this.mask(this.avatarUrl) : null;
  }

  /**
   * 30: below 48px the engraving is a smudge, so a bundled animal is drawn as its schematic.
   * The breakpoint is the rendered disc, which here is the Taiga size or the rem override.
   */
  get schematicUrl(): string | null {
    return usesSchematic(this.discPx) ? schematicAvatarUrl(this.avatarUrl) : null;
  }

  mask(url: string): string {
    return `url("${url}")`;
  }

  private get discPx(): number {
    return (this.sizeInRem ?? SIZE_REM[this.size]) * 16;
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
    return `${(this.sizeInRem ?? SIZE_REM[this.size]) * .46}rem`;
  }
}
