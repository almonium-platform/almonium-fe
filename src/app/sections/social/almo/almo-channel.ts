import {Channel} from 'stream-chat';
import {AppConstants} from '../../../app.constants';

/**
 * 11: how a client tells Almo's channel from a person's.
 *
 * He is a Stream channel like any other - the same private type the DMs use, with him as the second
 * member - so every rule about bubbles, receipts and typing applies to him for free. What is his
 * alone is the id shape the server mints, `almo_<user>_<lang>`, and that is the one thing read
 * here: never the display name, which is copy, and never the member list, which a purge can leave
 * half-built.
 */
export const ALMO_USER_ID = 'almo';
const ALMO_CHANNEL_ID_PREFIX = 'almo_';

export function isAlmoChannelId(id: string | undefined): boolean {
  return !!id && id.startsWith(ALMO_CHANNEL_ID_PREFIX);
}

export function isAlmoChannel(channel: Channel | undefined): boolean {
  return channel?.type === AppConstants.PRIVATE_CHAT_TYPE && isAlmoChannelId(channel.id);
}

/** `private:almo_<user>_de` -> true. Events and messages carry the cid, not the channel. */
export function isAlmoCid(cid: string | undefined): boolean {
  if (!cid) return false;
  const [type, id] = cid.split(':', 2);
  return type === AppConstants.PRIVATE_CHAT_TYPE && isAlmoChannelId(id);
}

/** The message sender, wherever Stream hands a user rather than a channel: a bubble's avatar, a typing row. */
export function isAlmoUser(user: {id: string} | undefined): boolean {
  return user?.id === ALMO_USER_ID;
}

/**
 * The language a conversation is, read off the id's tail so it is known before the server has
 * been asked anything: `almo_<uuid>_de` -> `DE`. The channel also carries it as data; the id is
 * the one that cannot be missing.
 */
export function almoLanguageOf(idOrCid: string | undefined): string | null {
  if (!idOrCid) return null;
  const id = idOrCid.includes(':') ? idOrCid.split(':', 2)[1] : idOrCid;
  if (!isAlmoChannelId(id)) return null;
  const code = id.slice(id.lastIndexOf('_') + 1);
  return /^[a-z]{2,3}$/i.test(code) ? code.toUpperCase() : null;
}
