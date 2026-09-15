import {Channel, ChannelMemberResponse, UserResponse} from 'stream-chat';
import {AppConstants} from '../../app.constants';

/**
 * The person on the other side of a private chat - and whether there still is one.
 *
 * Three components each found "the member who is not me" on their own, and each read the answer
 * off `member.user`. That field is optional, and a deleted account is exactly when it goes: Stream
 * soft-deletes the user and either drops them from the channel's members or leaves the member with
 * its user object stripped. Both come back to the client as a private chat with nobody resolvable on
 * the far side, so the absence is the signal, and it has to be read in one place or the row, the
 * header and the thread each draw a different ghost.
 */

/** The members of a channel who are not the given user. */
function othersIn(channel: Channel, myId: string | undefined): ChannelMemberResponse[] {
  return Object.values(channel.state?.members ?? {}).filter(member => (member.user_id ?? member.user?.id) !== myId);
}

/** The other member's user, when the channel is a private chat and still names one. */
export function interlocutorOf(channel: Channel | undefined, myId: string | undefined): UserResponse | undefined {
  if (channel?.type !== AppConstants.PRIVATE_CHAT_TYPE) return undefined;
  const others = othersIn(channel, myId);
  return others.length === 1 ? others[0].user : undefined;
}

/**
 * Whether the account on the other side of a private chat is gone.
 *
 * A private chat is created with both members and nobody leaves one, so a resolvable other member
 * is absent only because that account was deleted. Where the member does survive, the dates say the
 * same: deactivation is reversible and deletion is not, but the thread cannot be written to under
 * either, and both read the same way to the person still holding it.
 */
export function isInterlocutorGone(channel: Channel | undefined, myId: string | undefined): boolean {
  if (channel?.type !== AppConstants.PRIVATE_CHAT_TYPE) return false;
  const user = interlocutorOf(channel, myId);
  if (!user) return true;
  return !!user.deleted_at || !!user.deactivated_at;
}

/** Whether a user object - a message's sender, say - belongs to an account that is gone. */
export function isUserGone(user: UserResponse | undefined): boolean {
  return !!user && (!!user.deleted_at || !!user.deactivated_at);
}
