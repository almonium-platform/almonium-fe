import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  TemplateRef,
  ViewChild
} from '@angular/core';
import {Channel, StreamChat, UserResponse} from 'stream-chat';
import {
  ChannelActionsContext,
  ChannelHeaderInfoContext,
  ChannelService,
  CustomTemplatesService,
  TypingIndicatorContext
} from 'stream-chat-angular';
import {fromEventPattern, Observable, of, Subscription} from "rxjs";
import {TranslateModule} from "@ngx-translate/core";
import {AppConstants} from "../../../app.constants";
import {AsyncPipe, DatePipe, NgClass, NgStyle} from "@angular/common";
import {environment} from "../../../../environments/environment";
import {RelativeTimePipe} from "../custom-chat-avatar/relative-time.pipe";
import {LocalStorageService} from "../../../services/local-storage.service";

@Component({
  selector: 'app-chat-header',
  standalone: true,
  template: `
    <ng-template #typingIndicator let-usersTyping$="usersTyping$">
    </ng-template>
    <p
      data-testid="info"
      class="str-chat__header-livestream-left--members str-chat__channel-header-info"
      [ngClass]="!isSelfChat ? 'pb-1 pt-1' : ''"
      [ngStyle]="{
        'color': isPrivateChat && isInterlocutorOnline ? 'var(--chat-accent-color)' : '',
        'row-gap': isSelfChat ? 'unset' : ''
        }">
      @if (!isSelfChat) {
        @if (!isPrivateChat) {
          @if ((usersTyping$ | async); as typingUsers) {
            @if (typingUsers.length === 0) {
              {{ 'streamChat.{{ memberCount }} members' | translate: memberCountParam }}
            }
          }
        }
        @if (canReceiveConnectEvents) {
          @if (isPrivateChat) {
            @if ((usersTyping$ | async); as typingUsers) {
              @if (typingUsers.length === 1) {
                <span>typing...</span>
              }
              @if (typingUsers.length === 0) {
                <span>
                  {{ isInterlocutorOnline ? 'online' : (lastActiveTime ? ('last seen ' + (lastActiveTime | relativeTime)) : 'offline') }}
                </span>
              }
            }
          }
          @if (!isPrivateChat) {
            @if ((usersTyping$ | async); as typingUsers) {
              @if (typingUsers.length === 0) {
                <span>{{ 'streamChat.{{ watcherCount }} online' | translate: watcherCountParam }} </span>
              } @else if (typingUsers.length === 1) {
                {{ typingUsers[0].name || typingUsers[0].id }} is typing...
              } @else {
                {{ typingUsers.length }} people typing...
              }
            }
          }
        }
      }
    </p>
  `,
  imports: [
    TranslateModule,
    NgStyle,
    RelativeTimePipe,
    AsyncPipe,
    NgClass,
  ],
  styles: [`
    .str-chat__channel-header-info {
      color: #708599;
    }
  `],
  providers: [DatePipe]
})
export class ChatHeaderComponent implements OnChanges, OnDestroy, AfterViewInit {
  @ViewChild('typingIndicator') typingIndicator!: TemplateRef<TypingIndicatorContext>;

  @Input() channel: Channel | undefined;
  channelActionsTemplate?: TemplateRef<ChannelActionsContext>;
  channelHeaderInfoTemplate?: TemplateRef<ChannelHeaderInfoContext>;
  private activeChannel: Channel | undefined;
  protected canReceiveConnectEvents: boolean | undefined;
  protected isPrivateChat: boolean | undefined;
  protected isSelfChat: boolean | undefined;
  protected usersTyping$: Observable<UserResponse[]> = of([]);

  private subscriptions: Subscription[] = [];
  private presenceSubscription: Subscription | undefined;

  private chatClient = StreamChat.getInstance(environment.streamChatApiKey);
  private interlocutorId: string | undefined;
  protected lastActiveTime: Date | null | undefined;
  protected isOnline: boolean | undefined;

  constructor(
    private channelService: ChannelService,
    private customTemplatesService: CustomTemplatesService,
    private cdRef: ChangeDetectorRef,
    private localStorageService: LocalStorageService,
  ) {
    this.usersTyping$ = this.channelService.usersTypingInChannel$;

    this.subscriptions.push(
      this.channelService.activeChannel$.subscribe((c) => {
        this.activeChannel = c;
        this.isPrivateChat = c?.data?.name === AppConstants.PRIVATE_CHAT_NAME;
        this.isSelfChat = c?.data?.name === AppConstants.SELF_CHAT_NAME;
        const capabilities = this.activeChannel?.data?.own_capabilities as string[];
        if (capabilities) {
          this.canReceiveConnectEvents = capabilities.includes('connect-events');
        }
        if (this.isPrivateChat) {
          const user = this.getOtherMemberIfOneToOneChannel();
          if (user) {
            this.interlocutorId = user.id;
            this.isOnline = user.online;
          }
          this.fetchInterlocutorLastActive();
          this.subscribeToPresenceChanges();
        }
      })
    );
  }

  ngAfterViewInit(): void {
    this.customTemplatesService.typingIndicatorTemplate$.next(this.typingIndicator);
  }

  private subscribeToPresenceChanges(): void {
    if (!this.interlocutorId) return;

    this.presenceSubscription = fromEventPattern(
      (handler) => this.chatClient.on('user.presence.changed', handler),
      (handler) => this.chatClient.off('user.presence.changed', handler)
    ).subscribe((event: any) => {
      if (event.user?.id === this.interlocutorId) {
        if (this.interlocutorId) {
          this.lastActiveTime = new Date();
        }
        this.isOnline = event.user?.online;
        this.cdRef.detectChanges();
      }
    });
  }

  ngOnChanges(): void {
    this.subscriptions.push(
      this.customTemplatesService.channelActionsTemplate$.subscribe((template) => {
        this.channelActionsTemplate = template;
        this.cdRef.detectChanges();
      })
    );
    this.subscriptions.push(
      this.customTemplatesService.channelHeaderInfoTemplate$.subscribe((template) => {
        this.channelHeaderInfoTemplate = template;
        this.cdRef.detectChanges();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.presenceSubscription) {
      this.presenceSubscription.unsubscribe();
    }
    this.saveLastOnline();
  }

  private saveLastOnline() {
    if (this.isPrivateChat && this.interlocutorId && this.isInterlocutorOnline) {
      this.localStorageService.saveLastSeen(this.interlocutorId, new Date());
    }
  }

  get memberCountParam() {
    return {memberCount: this.activeChannel?.data?.member_count || 0};
  }

  get watcherCountParam() {
    return {watcherCount: this.activeChannel?.state?.watcher_count || 0};
  }

  get isInterlocutorOnline() {
    return this.isOnline;
  }

  private fetchInterlocutorLastActive() {
    const members = this.activeChannel?.state?.members;
    if (!members) return;

    const interlocutor = Object.values(members).find(
      (member) => member.user?.id !== this.chatClient.userID
    );

    if (!interlocutor?.user?.id) return;

    this.interlocutorId = interlocutor.user.id;

    // Set last seen immediately to avoid UI flicker
    const localLastSeen = this.localStorageService.getLastSeen(this.interlocutorId);
    this.lastActiveTime = localLastSeen;

    this.chatClient.queryUsers({id: {$in: [this.interlocutorId]}})
      .then((response) => {
        const user = response.users?.[0];
        if (!user) return;

        const apiLastActive = user.last_active ? new Date(user.last_active) : null;

        // Use the most recent last seen timestamp
        this.lastActiveTime = (localLastSeen && apiLastActive && localLastSeen > apiLastActive)
          ? localLastSeen
          : apiLastActive;

        // Only update local storage if API has more recent data
        if (this.interlocutorId && apiLastActive && (!localLastSeen || apiLastActive > localLastSeen)) {
          this.localStorageService.saveLastSeen(this.interlocutorId, apiLastActive);
        }

        this.cdRef.detectChanges();
      })
      .catch((error) => console.error('Error querying users:', error));
  }

  private getOtherMemberIfOneToOneChannel() {
    const otherMembers = Object.values(
      this.activeChannel?.state?.members || {}
    ).filter((m) => m.user_id !== this.chatClient.userID);
    if (otherMembers.length === 1) {
      return otherMembers[0].user;
    } else {
      return undefined;
    }
  }
}
