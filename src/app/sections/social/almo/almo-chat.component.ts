import {
  AfterViewInit,
  Component,
  DestroyRef,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {combineLatest} from 'rxjs';
import {filter} from 'rxjs/operators';
import {ChannelService, ChatClientService, CustomTemplatesService, MessageTextContext} from 'stream-chat-angular';
import {UserInfoService} from '../../../services/user-info.service';
import {SocialChannelFacade} from '../social-channel.facade';
import {AlmoChatCoordinator} from './almo-chat.coordinator';
import {AlmoOpener} from './almo-chat.model';
import {AlmoMessageTextComponent} from './almo-message-text.component';
import {AlmoSegment, segmentAlmoText} from './almo-text-segments';

/**
 * 11: Almo's presence in the thread. Sits between the message list and the composer, and does
 * two things: hands the message list the text renderer that knows his marks, and shows the opener
 * chips above an empty composer in his channel. It also starts the coordinator once the chat client
 * and the account are both known, so the social page itself has nothing to know about him.
 */
@Component({
  selector: 'app-almo-chat',
  standalone: true,
  imports: [AlmoMessageTextComponent],
  template: `
    <ng-template #almoMessageText let-message="message" let-isQuoted="isQuoted" let-shouldTranslate="shouldTranslate">
      <app-almo-message-text [message]="message" [isQuoted]="isQuoted" [shouldTranslate]="shouldTranslate"></app-almo-message-text>
    </ng-template>

    @if (coordinator.activeChat(); as chat) {
      <!-- Written in the target language at the learner's level, and sent as written. -->
      @if (coordinator.composerEmpty() && chat.openers.length) {
        <div class="almo-openers" role="group" aria-label="Ways to start">
          @for (opener of chat.openers; track opener.text) {
            <button type="button" class="almo-opener" (click)="send(opener.text)">
              @for (segment of segmentsOf(opener); track $index) {
                @if (segment.kind === 'plain') {
                  {{ segment.text }}
                } @else {
                  <span class="almo-word">{{ segment.text }}</span>
                }
              }
            </button>
          }
        </div>
      }
    }
  `,
  styleUrl: './almo-chat.component.less',
})
export class AlmoChatComponent implements AfterViewInit, OnDestroy {
  protected readonly coordinator = inject(AlmoChatCoordinator);
  private readonly channelService = inject(ChannelService);
  private readonly chatService = inject(ChatClientService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly channels = inject(SocialChannelFacade);
  private readonly customTemplates = inject(CustomTemplatesService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('almoMessageText', {static: true}) private messageText!: TemplateRef<MessageTextContext>;

  constructor() {
    combineLatest([
      this.userInfoService.userInfo$.pipe(filter(info => !!info)),
      // The connected user, which is what says the client can be asked to query and pin.
      this.chatService.user$.pipe(filter(user => !!user)),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([info]) => this.coordinator.start({id: info.id, premium: info.premium}, () => this.channels.reload(false)));
  }

  ngAfterViewInit(): void {
    this.customTemplates.messageTextTemplate$.next(this.messageText);
  }

  ngOnDestroy(): void {
    if (this.customTemplates.messageTextTemplate$.getValue() === this.messageText) {
      this.customTemplates.messageTextTemplate$.next(undefined);
    }
  }

  protected segmentsOf(opener: AlmoOpener): AlmoSegment[] {
    return segmentAlmoText(opener.text, opener.word ? [opener.word] : [], []);
  }

  protected send(text: string): void {
    void this.channelService.sendMessage(text);
  }
}
