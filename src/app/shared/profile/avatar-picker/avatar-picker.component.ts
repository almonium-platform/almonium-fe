import {DOCUMENT} from '@angular/common';
import {Component, EventEmitter, Input, Output, inject} from '@angular/core';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {UserInfoService} from '../../../services/user-info.service';
import {ProfileSettingsService} from '../../../sections/settings/profile/profile-settings.service';
import {avatarImageUrl, avatarLetter, isDefaultAvatar} from '../../avatar/avatar-display';

interface AvatarChoice {
  label: string;
  path: string;
  url: string;
}

@Component({
  selector: 'app-avatar-picker',
  templateUrl: './avatar-picker.component.html',
  styleUrl: './avatar-picker.component.less',
})
export class AvatarPickerComponent {
  private readonly document = inject(DOCUMENT);
  private readonly profileSettingsService = inject(ProfileSettingsService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly alertService = inject(TuiNotificationService);

  @Input({required: true}) userInfo!: {avatarUrl: string | null; username: string; premium: boolean};
  @Output() avatarChanged = new EventEmitter<string | null>();

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

  protected get displayAvatarUrl(): string | null {
    return avatarImageUrl(this.userInfo.avatarUrl);
  }

  protected get currentAvatarMask(): string | null {
    return this.userInfo.avatarUrl ? this.mask(this.userInfo.avatarUrl) : null;
  }

  protected get premiumCurrentAvatar(): boolean {
    return this.userInfo.premium && isDefaultAvatar(this.userInfo.avatarUrl);
  }

  protected useLetter(): void {
    if (this.busyUrl !== undefined) {
      return;
    }
    if (!this.userInfo.avatarUrl) {
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

  private choice(label: string, path: string): AvatarChoice {
    return {
      label,
      path,
      url: new URL(path, this.document.baseURI).href,
    };
  }

  private mask(url: string): string {
    return `url("${url}")`;
  }

  private finish(avatarUrl: string | null): void {
    this.userInfoService.updateUserInfo({avatarUrl});
    this.avatarChanged.emit(avatarUrl);
    this.busyUrl = undefined;
  }

  private fail(): void {
    this.busyUrl = undefined;
    this.alertService.open('Failed to update avatar', {appearance: 'negative'}).subscribe();
  }
}
