import {Channel} from 'stream-chat';
import {AppConstants} from '../../../app.constants';
import {stableHash} from '../../../shared/avatar/avatar-display';

/**
 * 03: what a broadcast channel puts in its disc.
 *
 * Every row in the column is the same circle and only the fill changes, so a channel never goes
 * transparent: the emblem's blades are a spiky silhouette, and bare it reads a size larger than
 * its neighbours. The app-wide room takes the emblem on a tinted disc; a language room takes its
 * own code in cream on a hue of its own, and drops the emblem entirely. Never both - two marks
 * do not fit one 38px slot, and the badge on the composed `logo-XX` asset is illegible below
 * about 64px, which is why that asset belongs to surfaces that draw at 64px and up.
 */
export type ChannelMark =
  | {kind: 'emblem'}
  | {kind: 'crest'; code: string; fill: string};

/** Stream ids: the app-wide room is `almonium`, a language room `almonium-de`. */
const BRAND_CHANNEL_ID = AppConstants.DEFAULT_CHANNEL_NAME.toLowerCase();

/** The languages the design has placed on the wheel; their two themes live in the token layer. */
const PLACED_CRESTS = new Set(['en', 'de', 'es', 'fr', 'it']);

export function channelMark(channel: Channel | undefined): ChannelMark | null {
  if (channel?.type !== AppConstants.BROADCAST_CHAT_TYPE) return null;

  const id = channel.id ?? '';
  if (id === BRAND_CHANNEL_ID) return {kind: 'emblem'};

  const code = id.startsWith(`${BRAND_CHANNEL_ID}-`) ? id.slice(BRAND_CHANNEL_ID.length + 1) : '';
  if (!/^[a-z]{2,3}$/.test(code)) return null;

  return {kind: 'crest', code: code.toUpperCase(), fill: crestFill(code)};
}

/**
 * A placed crest reads its colour from the token layer, which holds both themes. Anything newer
 * is generated on the same rule - chroma 0.10, and whatever lightness the theme keeps for the
 * band - off a hue hashed from the code, so a language added upstream still gets a disc that
 * carries cream letters instead of falling back to the app's blue.
 */
function crestFill(code: string): string {
  return PLACED_CRESTS.has(code)
    ? `var(--channel-crest-${code})`
    : `oklch(var(--channel-crest-lightness) 0.1 ${stableHash(code) % 360})`;
}
