import {DOCUMENT} from '@angular/common';
import {Component, Input, inject} from '@angular/core';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {UserInfo} from '../../../models/userinfo.model';
import {UserInfoService} from '../../../services/user-info.service';
import {avatarLetter, schematicAvatarUrl} from '../../avatar/avatar-display';
import {PremiumStarComponent} from '../../premium-star/premium-star.component';
import {ProfileSettingsService} from '../../../sections/settings/profile/profile-settings.service';

interface AvatarChoice {
  label: string;
  path: string;
  url: string;
  /** 30: the schematic drawn below 48px, shown under the engraving so the tile admits both. */
  small: string;
}

/**
 * 32: the one picker. Settings and the onboarding profile step draw the same row, because the
 * picker is the one place where the avatar is the subject rather than incidental: 62px
 * engravings with the schematic ghost under each, and no preview circle, since the engraving is
 * the preview. A host sets `--avatar-tile-gap` to fit its column; nothing else changes.
 */
@Component({
  selector: 'app-avatar-picker',
  templateUrl: './avatar-picker.component.html',
  styleUrl: './avatar-picker.component.less',
  imports: [PremiumStarComponent],
})
export class AvatarPickerComponent {
  private readonly document = inject(DOCUMENT);
  private readonly profileSettingsService = inject(ProfileSettingsService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly alertService = inject(TuiNotificationService);

  @Input({required: true}) userInfo!: UserInfo;

  protected busyUrl: string | null | undefined;
  protected readonly choices: AvatarChoice[] = [
    this.choice('Owl', 'assets/img/avatars/default/owl.png'),
    this.choice('Fox', 'assets/img/avatars/default/fox.png'),
    this.choice('Stag', 'assets/img/avatars/default/stag.png'),
    this.choice('Whale', 'assets/img/avatars/default/whale.png'),
    this.choice('Hare', 'assets/img/avatars/default/rabbit.png'),
  ];

  protected get letter(): string {
    return avatarLetter(this.userInfo.username);
  }

  protected useLetter(): void {
    if (this.busyUrl !== undefined || !this.userInfo.avatarUrl) {
      return;
    }
    this.busyUrl = null;
    this.profileSettingsService.resetAvatar().subscribe({
      next: () => this.finish(null),
      error: () => this.fail(),
    });
  }

  protected chooseAvatar(choice: AvatarChoice): void {
    if (this.busyUrl !== undefined || this.isSelected(choice)) {
      return;
    }
    this.busyUrl = choice.url;
    this.profileSettingsService.chooseDefaultAvatar(choice.url).subscribe({
      next: () => this.finish(choice.url),
      error: () => this.fail(),
    });
  }

  protected isSelected(choice: AvatarChoice): boolean {
    return this.userInfo.avatarUrl === choice.url || this.userInfo.avatarUrl?.endsWith(choice.path) === true;
  }

  protected displayChoiceUrl(choice: AvatarChoice): string {
    return choice.url;
  }

  protected choiceMask(choice: AvatarChoice): string {
    return this.mask(choice.url);
  }

  protected smallMask(choice: AvatarChoice): string {
    return this.mask(choice.small);
  }

  private choice(label: string, path: string): AvatarChoice {
    const url = new URL(path, this.document.baseURI).href;
    return {
      label,
      path,
      url,
      small: schematicAvatarUrl(url)!,
    };
  }

  private mask(url: string): string {
    return `url("${url}")`;
  }

  private finish(avatarUrl: string | null): void {
    this.userInfoService.updateUserInfo({avatarUrl});
    this.busyUrl = undefined;
  }

  private fail(): void {
    this.busyUrl = undefined;
    this.alertService.open('Failed to update avatar', {appearance: 'negative'}).subscribe();
  }
}
