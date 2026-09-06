import { AfterViewInit, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, inject } from '@angular/core';
import {Subscription, combineLatest} from 'rxjs';
import {Channel, User} from 'stream-chat';
import {AvatarLocation, AvatarType, ChatClientService, ThemeService,} from 'stream-chat-angular';
import {avatarHueClass, avatarLetter, schematicAvatarUrl} from '../../../shared/avatar/avatar-display';
import {AppConstants} from '../../../app.constants';
import {ChannelMark, channelMark} from './channel-mark';
import {isAlmoUser} from '../almo/almo-channel';
import {crestFill} from './crest-fill';
import {isInterlocutorGone, isUserGone} from '../interlocutor';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';

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
  private languages = inject(TargetLanguageDropdownService);
  private themeService = inject(ThemeService);

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
  /** 03: set on the app's own rooms, which draw a fill rather than a face. */
  protected mark: ChannelMark | null = null;
  protected crest: {code: string; fill: string} | null = null;
  hueClass = avatarHueClass('');
  /** 10: nobody answers for this disc any more, so it carries a mark rather than a face. */
  protected isDeletedAccount = false;
  fallbackChannelImage: string | undefined;
  private langColors: Record<string, string> = {};
  private isDark = false;
  private userId?: string;
  private isViewInited = false;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(
      // A crest is the language's own colour, so it follows both the stored palette and the
      // theme, whose band the disc is normalised into.
      combineLatest([this.languages.langColors$, this.themeService.theme$]).subscribe(([colors, theme]) => {
        this.langColors = colors;
        this.isDark = theme === 'dark';
        this.setChannelMark();
        if (this.isViewInited) {
          this.cdRef.detectChanges();
        }
      }),
      this.chatClientService.user$.subscribe(u => {
        if (u?.id !== this.userId) {
          this.userId = u?.id;
          if (this.type || this.channel || this.name) {
            this.setInitials();
            this.setFallbackChannelImage();
            this.setChannelMark();
            this.setDeletedAccount();
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

    if (changes['type'] || changes['channel'] || changes['user']) {
      this.setFallbackChannelImage();
      this.setChannelMark();
      this.setDeletedAccount();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private setChannelMark() {
    // 11: a bubble's avatar arrives as a user, not a channel; his is the same disc either way.
    this.mark = this.type === 'channel' ? channelMark(this.channel) : isAlmoUser(this.user) ? {kind: 'almo'} : null;
    this.crest = this.mark?.kind === 'crest'
      ? {code: this.mark.code, fill: crestFill(this.langColors[this.mark.code], this.isDark)}
      : null;
  }

  /**
   * The row this draws is the one place the absence has to be visible before the thread is
   * opened. A channel's disc asks about the member; a message's disc asks about its sender, whose
   * user object survives on the message after the member itself is gone.
   */
  private setDeletedAccount() {
    this.isDeletedAccount = this.type === 'channel'
      ? isInterlocutorGone(this.channel, this.userId)
      : isUserGone(this.user);
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
    this.hueClass = avatarHueClass(result);
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
   * The disc behind the mark: a plate under portrait art, a hashed hue under a letter, and
   * neither under the emblem or a crest, which bring their own fill.
   */
  protected get discClass(): string {
    if (this.isSavedMessages || this.mark) {
      return '';
    }

    // The hashed hue stands for a particular person, so a vacated disc takes the neutral plate
    // instead: it is the same disc every deleted account gets, which is the point.
    if (this.isDeletedAccount) {
      return 'avatar-plate';
    }

    return !this.isError && this.artUrl ? 'avatar-plate' : this.hueClass;
  }

  /**
   * The one place the art is resolved. Stream hands a channel with no picture an empty string,
   * not undefined, and `??` would take that string as a picture: the plate would go on and the
   * image would not. So the empty string is spelled out as absence here, and the plate, the
   * image and the schematic all read this rather than asking the inputs themselves.
   */
  protected get artUrl(): string | undefined {
    const candidates = [this.imageUrl, this.fallbackChannelImage];
    return candidates.find((url) => !!url);
  }

  /**
   * The composed `logo-XX` artwork the channel carries is drawn for 64px and up, so at avatar
   * size the app's own rooms ignore it and paint the disc themselves.
   */
  protected get showsImage(): boolean {
    return (
      !this.isSavedMessages &&
      !this.mark &&
      !this.isDeletedAccount &&
      !!this.artUrl &&
      !this.isError
    );
  }

  /**
   * 30: every chat disc is below 48px - the row's is 38, the message author's 30 - so a bundled
   * animal is always drawn as its schematic here, never as the engraving it smudges into.
   */
  protected get schematicUrl(): string | null {
    return this.showsImage ? schematicAvatarUrl(this.artUrl) : null;
  }

  protected get isEmblem(): boolean {
    return this.mark?.kind === 'emblem';
  }

  protected get isAlmo(): boolean {
    return this.mark?.kind === 'almo';
  }
}
