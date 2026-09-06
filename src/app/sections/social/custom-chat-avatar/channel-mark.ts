import {Channel} from 'stream-chat';
import {AppConstants} from '../../../app.constants';
import {isAlmoChannel} from '../../social/almo/almo-channel';

/**
 * 03: what a broadcast channel puts in its disc.
 *
 * Every row in the column is the same circle and only the fill changes, so a channel never goes
 * transparent: the emblem's blades are a spiky silhouette, and bare it reads a size larger than
 * its neighbours. The app-wide room takes the emblem on a tinted disc; a language room takes its
 * own code in cream on that language's colour, and drops the emblem entirely. Never both - two
 * marks do not fit one 38px slot, and the badge on the composed `logo-XX` asset is illegible
 * below about 64px, which is why that asset belongs to surfaces that draw at 64px and up.
 */
export type ChannelMark =
  | {kind: 'emblem'}
  | {kind: 'crest'; code: string}
  // 11: the one place Almo sits in a disc, because every contact's slot is one. Canon pose, no ring.
  | {kind: 'almo'};

/** Stream ids: the app-wide room is `almonium`, a language room `almonium-<code>`. */
const BRAND_CHANNEL_ID = AppConstants.DEFAULT_CHANNEL_NAME.toLowerCase();

/**
 * The suffix is the language, whichever language it is: adding one upstream is a room the client
 * already knows how to draw, not a case to add here.
 */
export function channelMark(channel: Channel | undefined): ChannelMark | null {
  if (isAlmoChannel(channel)) return {kind: 'almo'};
  if (channel?.type !== AppConstants.BROADCAST_CHAT_TYPE) return null;

  const id = channel.id ?? '';
  if (id === BRAND_CHANNEL_ID) return {kind: 'emblem'};

  const code = id.startsWith(`${BRAND_CHANNEL_ID}-`) ? id.slice(BRAND_CHANNEL_ID.length + 1) : '';
  return /^[a-z]{2,3}$/.test(code) ? {kind: 'crest', code: code.toUpperCase()} : null;
}
