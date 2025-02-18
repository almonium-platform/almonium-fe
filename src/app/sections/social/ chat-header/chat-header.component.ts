import {ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, TemplateRef} from '@angular/core';
import {Channel, StreamChat} from 'stream-chat';
import {
  ChannelActionsContext,
  ChannelHeaderInfoContext,
  ChannelService,
  CustomTemplatesService,
  DefaultStreamChatGenerics
} from 'stream-chat-angular';
import {Subscription} from "rxjs";
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
  activeChannel: Channel<DefaultStreamChatGenerics> | undefined;
  canReceiveConnectEvents: boolean | undefined;
  protected isPrivateChat: boolean | undefined;
  protected isSelfChat: boolean | undefined;
  private subscriptions: Subscription[] = [];
  private chatClient = StreamChat.getInstance(environment.streamChatApiKey);
  lastActiveTime: Date | null | undefined;
  private interlocutorId: string | undefined;

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
        }
        this.saveLastOnline();
      })
    );
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
    if (members) {
      const interlocutor = Object.values(members).find(
        (member) => member.user?.id !== this.chatClient.userID
      );

      if (interlocutor?.user?.id) {
        this.interlocutorId = interlocutor.user.id;

        const localLastSeen = this.localStorageService.getLastSeen(this.interlocutorId);

        this.chatClient.queryUsers({id: {$in: [this.interlocutorId]}})
          .then((response) => {
            const users = response.users;
            if (users.length > 0) {
              const apiLastActive = users[0].last_active ? new Date(users[0].last_active) : null;

              // Use the most recent last seen
              this.lastActiveTime = (localLastSeen && apiLastActive && localLastSeen > apiLastActive)
                ? localLastSeen
                : apiLastActive;

              this.cdRef.detectChanges();
            }
          })
          .catch((error) => {
            console.error('Error querying users:', error);
          });
      }
    }
  }
}
