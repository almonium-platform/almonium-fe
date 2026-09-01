import { AfterViewInit, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import {Subscription} from 'rxjs';
import {Channel, User} from 'stream-chat';
import {AvatarLocation, AvatarType, ChatClientService,} from 'stream-chat-angular';
import {avatarLetter} from '../../../shared/avatar/avatar-display';
import {AppConstants} from '../../../app.constants';

/**
 * Four fixed hues for the initial fallback. The disc is an identity, not a theme surface, so
 * the same person keeps the same one in either mode - see `Almonium Social and Chat`, 08.
 */
const HUE_COUNT = 4;

/**
 * The `Avatar` component displays the provided image, with fallback to the first letter of the optional name input.
 */
@Component({
  selector: 'app-custom-chat-avatar',
  templateUrl: './custom-chat-avatar.component.html',
  styleUrl: './custom-chat-avatar.component.less',
})
export class CustomChatAvatarComponent
  implements OnChanges, OnInit, AfterViewInit, OnDestroy {
  private chatClientService = inject(ChatClientService);
  private cdRef = inject(ChangeDetectorRef);

  /**
   * An optional name of the image, used for fallback image or image title (if `imageUrl` is provided)
   */
  @Input() name: string | undefined;
  /**
   * The URL of the image to be displayed. If the image can't be displayed the first letter of the name input is displayed.
   */
  @Input() imageUrl: string | undefined;
  /**
   * The location the avatar will be displayed in
   */
  @Input() location: AvatarLocation | undefined;
  /**
   * The channel the avatar belongs to (if avatar of a channel is displayed)
   */
  @Input() channel?: Channel;
  /**
   * The user the avatar belongs to (if avatar of a user is displayed)
   */
  @Input() user?: User;
  /**
   * The type of the avatar: channel if channel avatar is displayed, user if user avatar is displayed
   */
  @Input() type: AvatarType | undefined;
  /**
   * If channel/user image isn't provided the initials of the name of the channel/user is shown instead, you can choose how the initals should be computed
   */
  @Input() initialsType:
    | 'first-letter-of-first-word'
    | 'first-letter-of-each-word' = 'first-letter-of-first-word';
  isError = false;
  initials = '';
  hueClass = 'hue-1';
  fallbackChannelImage: string | undefined;
  private userId?: string;
  private isViewInited = false;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(
      this.chatClientService.user$.subscribe(u => {
        if (u?.id !== this.userId) {
          this.userId = u?.id;
          if (this.type || this.channel || this.name) {
            this.setInitials();
            this.setFallbackChannelImage();
          }
          if (this.isViewInited) {
            this.cdRef.detectChanges();
          }
        }
      })
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['type'] || changes['name'] || changes['channel']) {
      this.setInitials();
    }

    if (changes['type'] || changes['channel']) {
      this.setFallbackChannelImage();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private setFallbackChannelImage() {
    if (this.type !== 'channel') {
      this.fallbackChannelImage = undefined;
    } else {
      const otherMember = this.getOtherMemberIfOneToOneChannel();
      if (otherMember) {
        this.fallbackChannelImage = otherMember.image;
      } else {
        this.fallbackChannelImage = undefined;
      }
    }
  }

  private setInitials() {
    let result = '';
    if (this.type === 'user') {
      result = this.name?.toString() ?? '';
    } else if (this.type === 'channel') {
      if (this.channel?.data?.name) {
        result = this.channel?.data?.name;
      } else {
        const otherMember = this.getOtherMemberIfOneToOneChannel();
        if (otherMember) {
          result = (otherMember.name ?? otherMember.id) || '';
        } else {
          result = '#';
        }
      }
    }

    this.initials = this.type === 'channel' && result === '#' ? '#' : avatarLetter(result);
    this.hueClass = `hue-${(this.hash(result) % HUE_COUNT) + 1}`;
  }

  /** FNV-1a, the same hash the book covers pick their spine colour with. */
  private hash(value: string): number {
    let result = 2166136261;
    for (const character of value) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  ngAfterViewInit(): void {
    this.isViewInited = true;
  }

  private getOtherMemberIfOneToOneChannel() {
    if (this.channel?.type !== AppConstants.PRIVATE_CHAT_TYPE) {
      return undefined;
    }

    const otherMembers = Object.values(this.channel.state?.members || {}).filter(
      (m) => m.user_id !== this.userId
    );

    return otherMembers.length === 1 ? otherMembers[0].user : undefined;
  }

  protected get isSavedMessages(): boolean {
    return this.type === 'channel' && this.channel?.type === AppConstants.SELF_CHAT_TYPE;
  }

  /**
   * The disc behind the mark. Portrait art brings its own plate and the emblem its own fill,
   * so a hue is only ever wanted under an initial.
   */
  protected get discClass(): string {
    if (this.isSavedMessages || (!this.isError && (this.imageUrl || this.fallbackChannelImage))) {
      return '';
    }

    return this.hueClass;
  }
}
