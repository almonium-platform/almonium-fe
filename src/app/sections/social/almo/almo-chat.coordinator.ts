import {Injectable, OnDestroy, inject, signal} from '@angular/core';
import {Subscription, firstValueFrom} from 'rxjs';
import {filter} from 'rxjs/operators';
import {Channel, Event as StreamEvent} from 'stream-chat';
import {ChannelService, ChatClientService} from 'stream-chat-angular';
import {logger} from '../../../shared/logger';
import {AlmoChat} from './almo-chat.model';
import {AlmoChatService} from './almo-chat.service';
import {almoLanguageOf, isAlmoChannel, isAlmoCid} from './almo-channel';

/**
 * 11: what the chat list and the thread need to know about Almo, in one place for the life of the
 * Social page.
 *
 * Three things happen here and nowhere else. The server is asked for his channels - one per target
 * language, created on demand - and each is pinned so it sits above the human chats. The list's
 * ordering is taught that pinned rows stay on top when a message lands elsewhere. And every message
 * the learner sends in one of his channels is answered by asking the server for the reply, which
 * then arrives through Stream like any other message.
 */
@Injectable()
export class AlmoChatCoordinator implements OnDestroy {
  private readonly api = inject(AlmoChatService);
  private readonly chatService = inject(ChatClientService);
  private readonly channelService = inject(ChannelService);

  /** Almo's channels by cid, as the server described them. */
  readonly chats = signal<ReadonlyMap<string, AlmoChat>>(new Map());
  /** The one the thread is showing, or null when the thread is anybody else's. */
  readonly activeChat = signal<AlmoChat | null>(null);
  /** Kept by the composer directive; the opener chips read it, since they only sit above an empty field. */
  readonly composerEmpty = signal(true);

  private userId: string | null = null;
  private activeSubscription?: Subscription;
  private stopListening?: () => void;
  private readonly repliesRequested = new Set<string>();

  /**
   * Called once the chat client is connected and the account is known. Listeners install once;
   * the channels are asked for on every start, so a plan that began since the last visit shows up.
   */
  start(user: {id: string; premium: boolean}, reload: () => void): void {
    if (this.userId !== user.id) {
      this.stop();
      this.userId = user.id;
      this.keepPinnedRowsFirst();
      this.followActiveChannel();
      this.answerOwnMessages(user.id);
    }

    if (!user.premium) return;

    this.api.ensureChats().subscribe({
      next: chats => void this.adopt(chats, reload),
      error: error => logger.error("Could not set up Almo's channels", error),
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private stop(): void {
    this.activeSubscription?.unsubscribe();
    this.stopListening?.();
    this.stopListening = undefined;
    this.channelService.customNewMessageHandler = undefined;
    this.userId = null;
  }

  /**
   * Pins whatever is not pinned yet, then reloads the list if it does not already show every
   * channel in its place. Steady state is no reload at all: the list the page opened with is right.
   */
  private async adopt(chats: AlmoChat[], reload: () => void): Promise<void> {
    this.chats.set(new Map(chats.map(chat => [chat.cid, chat])));
    this.refreshActiveChat(this.channelService.activeChannel ?? undefined);
    if (!chats.length) return;

    try {
      await firstValueFrom(this.channelService.channelQueryState$.pipe(filter(state => state?.state === 'success')));
      const listed = new Set(this.channelService.channels.map(channel => channel.cid));
      const cids = chats.map(chat => chat.cid);
      let changed = cids.some(cid => !listed.has(cid));

      const channels = await this.chatService.chatClient.queryChannels({cid: {$in: cids}}, undefined, {limit: cids.length});
      for (const channel of channels) {
        if (!channel.state.membership?.pinned_at) {
          await channel.pin();
          changed = true;
        }
      }

      if (changed) reload();
    } catch (error) {
      logger.error("Could not pin Almo's channels", error);
    }
  }

  /**
   * The SDK moves a channel to the top of the list when a message lands in it. A pinned row has
   * to stay above that, so the move happens within the row's own group instead.
   */
  private keepPinnedRowsFirst(): void {
    this.channelService.customNewMessageHandler = (_event, channel, setChannels) => {
      const isPinned = (candidate: Channel) => !!candidate.state.membership?.pinned_at;
      const rest = this.channelService.channels.filter(candidate => candidate.cid !== channel.cid);
      if (isPinned(channel)) {
        setChannels([channel, ...rest]);
        return;
      }
      setChannels([...rest.filter(isPinned), channel, ...rest.filter(candidate => !isPinned(candidate))]);
    };
  }

  private followActiveChannel(): void {
    this.activeSubscription = this.channelService.activeChannel$.subscribe(channel => this.refreshActiveChat(channel));
  }

  private refreshActiveChat(channel: Channel | undefined): void {
    if (!channel || !isAlmoChannel(channel)) {
      this.activeChat.set(null);
      return;
    }
    // The server may not have answered yet; the id alone is enough to know whose thread this is.
    this.activeChat.set(
      this.chats().get(channel.cid) ?? {
        cid: channel.cid,
        language: almoLanguageOf(channel.id) ?? '',
        name: channel.data?.name ?? '',
        placeholder: '',
        openers: [],
      },
    );
  }

  /**
   * A message of the learner's own in one of his channels is a question to the server. Stream
   * echoes every send back as `message.new`, so the send path itself is left alone - and the same
   * message id from two open tabs buys one reply, because the server keys on it.
   */
  private answerOwnMessages(userId: string): void {
    const handler = (event: StreamEvent) => {
      const message = event.message;
      if (!message || event.user?.id !== userId || !isAlmoCid(event.cid)) return;
      if (this.repliesRequested.has(message.id)) return;
      this.repliesRequested.add(message.id);

      const language = this.chats().get(event.cid ?? '')?.language ?? almoLanguageOf(event.cid);
      if (!language) return;

      this.api.requestReply(language, message.id).subscribe({
        // A reached ceiling is deliberately silent: it is a cost control, not a feature.
        error: error => logger.error('Almo could not answer', error),
      });
    };
    const {unsubscribe} = this.chatService.chatClient.on('message.new', handler);
    this.stopListening = unsubscribe;
  }
}
