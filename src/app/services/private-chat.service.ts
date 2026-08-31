import {Injectable, inject} from '@angular/core';
import {Channel} from 'stream-chat';
import {ChatClientService} from 'stream-chat-angular';
import {AppConstants} from '../app.constants';

/**
 * Where a private chat's address and shape are decided. A DM is derived entirely from the
 * friendship it belongs to — same id on both sides, no name of its own — so the rule lives in one
 * place rather than in every component that happens to open one.
 */
@Injectable({providedIn: 'root'})
export class PrivateChatService {
  private readonly chatService = inject(ChatClientService);

  channelId(friendshipId: string): string {
    return `private_${friendshipId}`;
  }

  cid(friendshipId: string): string {
    return `${AppConstants.PRIVATE_CHAT_TYPE}:${this.channelId(friendshipId)}`;
  }

  async create(userId: string, recipientId: string, friendshipId: string): Promise<Channel> {
    if (!this.chatService.chatClient.user) {
      throw new Error('User must be connected before creating a chat.');
    }

    const channel = this.chatService.chatClient.channel(AppConstants.PRIVATE_CHAT_TYPE, this.channelId(friendshipId), {
      members: [userId, recipientId],
      created_by_id: userId,
    });

    await channel.create();
    await channel.watch();
    return channel;
  }
}
