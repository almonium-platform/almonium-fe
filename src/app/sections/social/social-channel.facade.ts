import {Injectable, inject} from '@angular/core';
import {Channel, ChannelSort} from 'stream-chat';
import {ChannelService, ChatClientService} from 'stream-chat-angular';
import {AppConstants} from '../../app.constants';
import {DELETED_ACCOUNT_NAME} from './social-copy';
import {interlocutorOf, isInterlocutorGone} from './interlocutor';
import {PrivateChatService} from '../../services/private-chat.service';
import {isAlmoChannel} from './almo/almo-channel';

/**
 * 11: the order every channel query asks for. Almo's rows are pinned, and a pinned row sits above
 * every human chat however recent theirs is; within each group the newest message wins.
 */
export const CHANNEL_SORT: ChannelSort = [{pinned_at: -1}, {last_message_at: -1}];

/** Encapsulates Stream channel naming, membership, and command semantics. */
@Injectable()
export class SocialChannelFacade {
  private readonly chatService = inject(ChatClientService);
  private readonly channelService = inject(ChannelService);
  private readonly privateChats = inject(PrivateChatService);
  private userId: string | null = null;

  setCurrentUser(userId: string): void {
    this.userId = userId;
  }

  friendshipCid(friendshipId: string): string {
    return this.privateChats.cid(friendshipId);
  }

  /** Which friendship a private channel belongs to, for the actions that are keyed on one. */
  friendshipIdOf(channel: Channel): string | null {
    return this.privateChats.friendshipId(channel.id);
  }

  async createPrivateChat(recipientId: string, friendshipId: string): Promise<Channel> {
    if (!this.userId) {
      throw new Error('User must be connected before creating a chat.');
    }

    return this.privateChats.create(this.userId, recipientId, friendshipId);
  }

  async openByCid(cid: string): Promise<boolean> {
    const channels = await this.chatService.chatClient.queryChannels({cid: {$eq: cid}});
    if (!channels.length) return false;
    this.channelService.setAsActiveChannel(channels[0]);
    return true;
  }

  /**
   * A private chat has no name of its own, only an interlocutor; every other channel carries one.
   * Reading the type rather than the stored name also keeps the placeholder that older channels
   * were created with from ever reaching the screen.
   */
  name(channel: Channel, fallback: string): string {
    // 11: his channel is named for its language - "Almo · Deutsch" - and the server minted that name.
    if (this.isAlmo(channel)) return channel.data?.name ?? fallback;
    if (this.isPrivate(channel)) {
      // A handle belongs to somebody. Once nobody answers for it, the row says so instead of
      // going on addressing a person who is not there.
      if (this.isInterlocutorDeleted(channel)) return DELETED_ACCOUNT_NAME;
      return this.interlocutorName(channel) ?? fallback;
    }
    return channel.data?.name ?? fallback;
  }

  /**
   * 10: deleting an account leaves its private threads standing. The server drops the person from
   * the rooms and deletes their Saved Messages, but a DM has two members and only one of them
   * left, so the other keeps the history. What Stream leaves of the departed member is decided in
   * `interlocutor.ts`, which is the one place that reads it.
   */
  isInterlocutorDeleted(channel: Channel): boolean {
    return isInterlocutorGone(channel, this.chatService.chatClient.userID);
  }

  private interlocutorName(channel: Channel): string | undefined {
    return this.interlocutor(channel)?.name;
  }

  /**
   * Membership is a field on the Stream user, so the chat list can ring a member's avatar without
   * a request of its own - and without the person having to be a friend.
   *
   * Stream hands the avatar template a channel only where the avatar stands for one. A message
   * sender, a header, a typing indicator all arrive with `channel` undefined, and this binding is
   * read on every change detection, so an absent channel has to mean "no ring" rather than a throw.
   */
  isInterlocutorPremium(channel: Channel | undefined): boolean {
    if (!channel || !this.isPrivate(channel) || this.isInterlocutorDeleted(channel)) return false;
    return this.interlocutor(channel)?.premium === true;
  }

  private interlocutor(channel: Channel) {
    return interlocutorOf(channel, this.chatService.chatClient.userID);
  }

  /**
   * 11: a thread with Almo. It shares the DMs' channel type, so every rule about bubbles and typing
   * holds; what it is not is a conversation with a person, so presence, profile cards, blocking
   * and deletion all read `isPrivate`, and that says no.
   */
  isAlmo(channel: Channel): boolean {
    return isAlmoChannel(channel);
  }

  isPrivate(channel: Channel): boolean {
    return channel.type === AppConstants.PRIVATE_CHAT_TYPE && !isAlmoChannel(channel);
  }

  isSelf(channel: Channel): boolean {
    return channel.type === AppConstants.SELF_CHAT_TYPE;
  }

  /**
   * The subject a broadcast channel is about: "Almonium — Deutsch" -> "Deutsch".
   * Falls back to the full channel name when there is no separator.
   */
  topic(channel: Channel): string {
    const name = channel.data?.name ?? '';
    const parts = name.split(/\s[\u2014\u2013-]\s/);
    return (parts.at(-1) ?? name).trim();
  }

  isPublic(channel: Channel): boolean {
    return !this.isPrivate(channel) && !this.isSelf(channel) && !this.isAlmo(channel);
  }

  isMember(channel: Channel): boolean {
    return !!this.userId && channel.state.members[this.userId] !== undefined;
  }

  isLastMessageFromAnotherUser(channel: Channel): boolean {
    const lastMessage = channel.state.messages.at(-1);
    return !!lastMessage && lastMessage.user?.id !== this.chatService.chatClient.userID;
  }

  reload(hidden: boolean): void {
    if (!this.userId) return;
    this.channelService.reset();
    void this.channelService.init({hidden, members: {$in: [this.userId]}}, CHANNEL_SORT, undefined, false);
  }

  async join(channel: Channel): Promise<void> {
    if (!this.userId) return;
    await channel.addMembers([this.userId]);
    await new Promise(resolve => setTimeout(resolve, 600));
    this.channelService.setAsActiveChannel(channel);
  }
}
