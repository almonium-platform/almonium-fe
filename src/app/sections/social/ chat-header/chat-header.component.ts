import {ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, TemplateRef} from '@angular/core';
import {Channel} from 'stream-chat';
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
import {NgStyle} from "@angular/common";

@Component({
  selector: 'app-chat-header',
  standalone: true,
  template: `
    <p
      data-testid="info"
      class="str-chat__header-livestream-left--members str-chat__channel-header-info"
      [ngStyle]="isPrivateChat && isInterlocutorOnline ? {'color': 'var(--chat-accent-color)'} : {}"
    >
      @if (!isSelfChat) {
        @if (!isPrivateChat) {
          {{ 'streamChat.{{ memberCount }} members' | translate:memberCountParam }}
        }
        {{
          canReceiveConnectEvents
            ? (isPrivateChat
              ? (isInterlocutorOnline ? 'online' : 'offline')
              : ('streamChat.{{ watcherCount }} online' |
                translate:watcherCountParam))
            : ''
        }}
      }
    </p>
  `,
  imports: [
    TranslateModule,
    NgStyle
  ],
  styles: [`
    .str-chat__channel-header-info {
      color: #708599;
    }
  `]
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

  constructor(private channelService: ChannelService,
              private customTemplatesService: CustomTemplatesService,
              private cdRef: ChangeDetectorRef,
  ) {
    this.channelService = channelService;
    this.channelService.activeChannel$.subscribe((c) => {
      this.activeChannel = c;
      this.isPrivateChat = c?.data?.name === AppConstants.PRIVATE_CHAT_NAME;
      this.isSelfChat = c?.data?.name === AppConstants.SELF_CHAT_NAME;
      const capabilities = this.activeChannel?.data
        ?.own_capabilities as string[];
      if (!capabilities) {
        return;
      }
      this.canReceiveConnectEvents =
        capabilities.indexOf('connect-events') !== -1;
    });
  }

  ngOnChanges(): void {
    this.subscriptions.push(
      this.customTemplatesService.channelActionsTemplate$.subscribe(
        (template) => {
          this.channelActionsTemplate = template;
          this.cdRef.detectChanges();
        }
      )
    );
    this.subscriptions.push(
      this.customTemplatesService.channelHeaderInfoTemplate$.subscribe(
        (template) => {
          this.channelHeaderInfoTemplate = template;
          this.cdRef.detectChanges();
        }
      )
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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
}
