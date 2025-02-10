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

@Component({
  selector: 'app-chat-header',
  standalone: true,
  template: `
    <p
      data-testid="info"
      class="str-chat__header-livestream-left--members str-chat__channel-header-info"
    >
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
    </p>
  `,
  imports: [
    TranslateModule
  ],
  styles: []
})
export class ChatHeaderComponent implements OnChanges, OnDestroy {
  @Input() channel: Channel<DefaultStreamChatGenerics> | undefined;
  channelActionsTemplate?: TemplateRef<ChannelActionsContext>;
  channelHeaderInfoTemplate?: TemplateRef<ChannelHeaderInfoContext>;
  activeChannel: Channel<DefaultStreamChatGenerics> | undefined;
  canReceiveConnectEvents: boolean | undefined;
  protected isPrivateChat: boolean | undefined;
  private subscriptions: Subscription[] = [];

  constructor(private channelService: ChannelService,
              private customTemplatesService: CustomTemplatesService,
              private cdRef: ChangeDetectorRef,
  ) {
    this.channelService = channelService;
    this.channelService.activeChannel$.subscribe((c) => {
      this.activeChannel = c;
      this.isPrivateChat = c?.data?.name === 'Private Chat';
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
