import {Component, Input} from '@angular/core';

/**
 * The premium mark. One glyph, one meaning: a bevelled plum disc carrying the star, the same
 * mark the plan line and the member controls draw.
 *
 * It is set after a printed name, never around an avatar. A gradient ring on a disc means
 * "unseen story, tap me" to anyone who has used a phone in the last decade, and a tier mark
 * cannot afford to be read as an invitation - so the rings are withdrawn and this is what
 * replaced them. The one avatar that carries it is the profile card, where the star is seated
 * in the corner at a size the disc can hold; see `AvatarComponent`.
 *
 * Size is set from outside through the two custom properties, because the disc and the glyph do
 * not scale together: at 16px the star wants 9 of them, at 28px it wants 14.
 */
@Component({
  selector: 'app-premium-star',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
    </svg>
  `,
  host: {
    role: 'img',
    '[attr.aria-label]': 'label',
  },
  styles: [`
    :host {
      --premium-star-size: 1rem;
      --premium-star-glyph: .5625rem;
      /* A full box-shadow layer rather than a colour, so a host that needs no keyline pays nothing. */
      --premium-star-keyline: 0 0 0 0 transparent;

      display: grid;
      width: var(--premium-star-size);
      height: var(--premium-star-size);
      flex: 0 0 var(--premium-star-size);
      place-items: center;
      border-radius: 50%;
      background: var(--premium-gradient);
      box-shadow:
        inset 0 1px 0 rgba(255, 240, 250, .45),
        inset 0 -1px 0 rgba(20, 6, 30, .3),
        0 2px 6px rgba(72, 23, 125, .3),
        var(--premium-star-keyline);
    }

    :host svg {
      display: block;
      width: var(--premium-star-glyph);
      height: var(--premium-star-glyph);
      /* Not the page's cream: the glyph sits on plum and needs the warm tint to stay legible. */
      fill: #FFF1F6;
    }
  `],
})
export class PremiumStarComponent {
  /** What a screen reader says. "Member" beside a name, "Premium member" where the name is the subject. */
  @Input() label = 'Member';
}
