// One file per animal: the tier is the gradient on the ink, not a second drawing.
const DEFAULT_AVATAR_PATH = /assets\/img\/avatars\/default\/(owl|fox|stag|whale|rabbit)\.png(?:[?#].*)?$/;

export function avatarLetter(username: string | null | undefined): string {
  return username?.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase() ?? '·';
}

/**
 * The disc under a letter is an identity, not a theme surface: one of four fixed hues, picked
 * by a hash of the name, so the same person keeps the same colour in either mode and wherever
 * they are drawn. Artwork never takes a hue - it brings its own light plate.
 *
 * Two spellings of one answer. `avatarHueClass` pairs with `.avatar-hue-*` in shared-styles
 * and is what to reach for; `avatarHueToken` is for the one disc Taiga owns, where a class of
 * equal specificity loses to the library's own rule and only an inline style wins.
 */
export function avatarHueClass(name: string | null | undefined): string {
  return `avatar-hue-${avatarHue(name)}`;
}

export function avatarHueToken(name: string | null | undefined, part: 'fill' | 'ink'): string {
  const hue = avatarHue(name);
  return part === 'fill' ? `var(--avatar-hue-${hue})` : `var(--avatar-hue-${hue}-ink)`;
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
