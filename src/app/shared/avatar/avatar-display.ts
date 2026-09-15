// 30: two renderings per animal, split by the size of the disc they are drawn on, never by tier.
// The engraving is the illustration voice and stays wherever the disc is 48px or larger; below
// that it collapses into a smudge, so a line schematic of the same silhouette takes over. Tier
// is still the gradient on the ink of whichever one is drawn.
const DEFAULT_AVATAR_PATH = /assets\/img\/avatars\/default\/(owl|fox|stag|whale|rabbit)\.png(?:[?#].*)?$/;

/** The rendered disc size, in CSS px, below which the engraving stops reading. */
export const AVATAR_ENGRAVING_MIN_PX = 48;

/** The breakpoint is the rendered disc, not the asset: a 40px disc draws the schematic. */
export function usesSchematic(discPx: number): boolean {
  return discPx < AVATAR_ENGRAVING_MIN_PX;
}

/**
 * The schematic for a bundled animal, or null for a letter or an uploaded photo, which have no
 * small tier. The file is plum ink on transparency, so it sits on the same plate the engraving
 * does; a member paints it through a mask instead, the way the engraving is painted.
 */
export function schematicAvatarUrl(avatarUrl: string | null | undefined): string | null {
  const animal = avatarUrl?.match(DEFAULT_AVATAR_PATH)?.[1];
  return animal ? `assets/img/avatars/small/${animal}-small-plum.svg` : null;
}

export function avatarLetter(username: string | null | undefined): string {
  return username?.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? '·';
}

/**
 * One of four identities, picked by a hash of the name, so the same person keeps the same slot
 * wherever they are drawn. The hue is a sorting aid, not a decoration: it belongs only where
 * several avatars are scanned at once - the chat list, group threads, the People panel - and is
 * wrong on any surface that shows exactly one, which has nothing to be told apart from. Each
 * theme draws the four with its own values; artwork never takes a hue at all, it brings a plate.
 *
 * Two spellings of one answer. `avatarHueClass` pairs with `.avatar-hue-*` in shared-styles and
 * is what to reach for; `avatarHueToken` is for the one disc Taiga owns, where a class of equal
 * specificity loses to the library's own rule and only an inline style wins. Neither carries the
 * ink: that is `--avatar-hue-ink`, one value per theme rather than one per hue.
 */
export function avatarHueClass(name: string | null | undefined): string {
  return `avatar-hue-${avatarHue(name)}`;
}

export function avatarHueToken(name: string | null | undefined, part: 'fill' | 'edge'): string {
  const hue = avatarHue(name);
  return part === 'fill' ? `var(--avatar-hue-${hue})` : `var(--avatar-hue-${hue}-edge)`;
}

function avatarHue(name: string | null | undefined): number {
  return (stableHash(name ?? '') % AVATAR_HUES) + 1;
}

const AVATAR_HUES = 4;

/**
 * FNV-1a, the same hash the book covers pick their spine colour with. Exported because a
 * channel crest picks a hue angle off the wheel rather than one of four buckets, and the two
 * have to agree on how a name becomes a number.
 */
export function stableHash(value: string): number {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function isDefaultAvatar(avatarUrl: string | null | undefined): boolean {
  return !!avatarUrl && DEFAULT_AVATAR_PATH.test(avatarUrl);
}

export function avatarImageUrl(
  avatarUrl: string | null | undefined,
): string | null {
  return avatarUrl ?? null;
}
