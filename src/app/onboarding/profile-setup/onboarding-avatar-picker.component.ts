import {Component, Input, OnInit, inject} from '@angular/core';
import {AvatarComponent} from '../../shared/avatar/avatar.component';
import {FirebaseService} from '../../sections/settings/profile/avatar/firebase.service';
import {ProfileSettingsService} from '../../sections/settings/profile/profile-settings.service';
import {UserInfoService} from '../../services/user-info.service';
import {TuiNotificationService} from '@taiga-ui/core/components';

@Component({
  selector: 'app-onboarding-avatar-picker',
  imports: [AvatarComponent],
  templateUrl: './onboarding-avatar-picker.component.html',
  styleUrl: './onboarding-avatar-picker.component.less',
})
export class OnboardingAvatarPickerComponent implements OnInit {
  private readonly firebaseService = inject(FirebaseService);
  private readonly profileSettingsService = inject(ProfileSettingsService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly alertService = inject(TuiNotificationService);

  @Input({required: true}) userInfo!: {avatarUrl: string | null; username: string; premium: boolean};
  protected defaultAvatars: string[] = [];

  ngOnInit(): void {
    void this.loadDefaultAvatars();
  }

  protected useInitials(): void {
    this.profileSettingsService.resetAvatar().subscribe({
      next: () => this.finish(null),
      error: () => this.alertService.open('Failed to update avatar', {appearance: 'negative'}).subscribe(),
    });
  }

  protected chooseAvatar(url: string): void {
    this.profileSettingsService.chooseDefaultAvatar(url).subscribe({
      next: () => this.finish(url),
      error: () => this.alertService.open('Failed to update avatar', {appearance: 'negative'}).subscribe(),
    });
  }

  private async loadDefaultAvatars(): Promise<void> {
    try {
      this.defaultAvatars = (await this.firebaseService.getDefaultAvatars('avatars/users/default')).slice(0, 5);
    } catch {
      this.alertService.open('Could not load avatar choices', {appearance: 'negative'}).subscribe();
    }
  }

  private finish(avatarUrl: string | null): void {
    this.userInfoService.updateUserInfo({avatarUrl});
  }
}
