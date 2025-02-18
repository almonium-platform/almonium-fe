import {ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, TemplateRef} from '@angular/core';
import {Channel, StreamChat} from 'stream-chat';
import {
  ChannelActionsContext,
  ChannelHeaderInfoContext,
  ChannelService,
  CustomTemplatesService,
  DefaultStreamChatGenerics
} from 'stream-chat-angular';
import {fromEventPattern, Subscription} from "rxjs";
import {TranslateModule} from "@ngx-translate/core";
import {AppConstants} from "../../../app.constants";
import {DatePipe, NgIf, NgStyle} from "@angular/common";
import {environment} from "../../../../environments/environment";
import {RelativeTimePipe} from "../custom-chat-avatar/relative-time.pipe";
import {LocalStorageService} from "../../../services/local-storage.service";

@Component({
  selector: 'app-chat-header',
  standalone: true,
  template: `
    <p
      data-testid="info"
      class="str-chat__header-livestream-left--members str-chat__channel-header-info"
      [ngStyle]="isPrivateChat && isInterlocutorOnline ? {'color': 'var(--chat-accent-color)'} : {}"
    >
      <ng-container *ngIf="!isSelfChat">
        <ng-container *ngIf="!isPrivateChat">
          {{ 'streamChat.{{ memberCount }} members' | translate: memberCountParam }}
        </ng-container>
        <ng-container *ngIf="canReceiveConnectEvents">
          <ng-container *ngIf="isPrivateChat">
            {{ isInterlocutorOnline ? 'online' : (lastActiveTime ? ('last seen ' + (lastActiveTime | relativeTime)) : 'offline') }}
          </ng-container>
          <ng-container *ngIf="!isPrivateChat">
            {{ 'streamChat.{{ watcherCount }} online' | translate: watcherCountParam }}
          </ng-container>
        </ng-container>
      </ng-container>
    </p>
  `,
  imports: [
    TranslateModule,
    NgStyle,
    NgIf,
    RelativeTimePipe
  ],
  styles: [`
    .str-chat__channel-header-info {
      color: #708599;
    }
  `],
  providers: [DatePipe]
})
export class ChatHeaderComponent implements OnChanges, OnDestroy {
  @Input() channel: Channel<DefaultStreamChatGenerics> | undefined;
  channelActionsTemplate?: TemplateRef<ChannelActionsContext>;
  channelHeaderInfoTemplate?: TemplateRef<ChannelHeaderInfoContext>;
  private activeChannel: Channel<DefaultStreamChatGenerics> | undefined;
  protected canReceiveConnectEvents: boolean | undefined;
  protected isPrivateChat: boolean | undefined;
  protected isSelfChat: boolean | undefined;

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
          this.fetchInterlocutorLastActive();
          this.subscribeToPresenceChanges();
        }
      })
    );
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
    return this.watcherCountParam.watcherCount > 1;
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
}
