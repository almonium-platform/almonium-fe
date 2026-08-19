import {DOCUMENT} from '@angular/common';
import {Component, Input, inject} from '@angular/core';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {UserInfo} from '../../../../../models/userinfo.model';
import {UserInfoService} from '../../../../../services/user-info.service';
import {avatarImageUrl, avatarLetter} from '../../../../../shared/avatar/avatar-display';
import {ProfileSettingsService} from '../../profile-settings.service';

interface SettingsAvatarChoice {
  label: string;
  path: string;
  url: string;
  premiumUrl: string;
}

@Component({
  selector: 'app-settings-avatar-picker',
  templateUrl: './settings-avatar-picker.component.html',
  styleUrl: './settings-avatar-picker.component.less',
})
export class SettingsAvatarPickerComponent {
  private readonly document = inject(DOCUMENT);
  private readonly profileSettingsService = inject(ProfileSettingsService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly alertService = inject(TuiNotificationService);

  @Input({required: true}) userInfo!: UserInfo;

  protected busyUrl: string | null | undefined;
  protected readonly choices: SettingsAvatarChoice[] = [
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
    return avatarImageUrl(this.userInfo.avatarUrl, this.userInfo.premium);
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

  protected chooseAvatar(choice: SettingsAvatarChoice): void {
    if (this.busyUrl !== undefined || this.isSelected(choice)) {
      return;
    }
    this.busyUrl = choice.url;
    this.profileSettingsService.chooseDefaultAvatar(choice.url).subscribe({
      next: () => this.finish(choice.url),
      error: () => this.fail(),
    });
  }

  protected isSelected(choice: SettingsAvatarChoice): boolean {
    return this.userInfo.avatarUrl === choice.url || this.userInfo.avatarUrl?.endsWith(choice.path) === true;
  }

  protected displayChoiceUrl(choice: SettingsAvatarChoice): string {
    return this.userInfo.premium ? choice.premiumUrl : choice.url;
  }

  private choice(label: string, path: string): SettingsAvatarChoice {
    return {
      label,
      path,
      url: new URL(path, this.document.baseURI).href,
      premiumUrl: new URL(path.replace('/default/', '/default/premium/'), this.document.baseURI).href,
    };
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
