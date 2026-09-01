import {Injectable, inject} from '@angular/core';
import {Channel} from 'stream-chat';
import {ChannelService, ChatClientService} from 'stream-chat-angular';
import {AppConstants} from '../../app.constants';
import {PrivateChatService} from '../../services/private-chat.service';

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
    if (this.isPrivate(channel)) return this.interlocutorName(channel) ?? fallback;
    return channel.data?.name ?? fallback;
  }

  private interlocutorName(channel: Channel): string | undefined {
    return this.interlocutor(channel)?.name;
  }

  /**
   * Membership is a field on the Stream user, so the chat list can ring a member's avatar without
   * a request of its own - and without the person having to be a friend.
   */
  isInterlocutorPremium(channel: Channel): boolean {
    return this.isPrivate(channel) && this.interlocutor(channel)?.premium === true;
  }

  private interlocutor(channel: Channel) {
    const currentUserId = this.chatService.chatClient.userID;
    return Object.values(channel.state.members)
      .find(member => member.user?.id !== currentUserId)
      ?.user;
  }

  isPrivate(channel: Channel): boolean {
    return channel.type === AppConstants.PRIVATE_CHAT_TYPE;
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
    return !this.isPrivate(channel) && !this.isSelf(channel);
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
    void this.channelService.init({hidden, members: {$in: [this.userId]}}, undefined, undefined, false);
  }

  async join(channel: Channel): Promise<void> {
    if (!this.userId) return;
    await channel.addMembers([this.userId]);
    await new Promise(resolve => setTimeout(resolve, 600));
    this.channelService.setAsActiveChannel(channel);
  }
}
