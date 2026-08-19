import {TestBed} from '@angular/core/testing';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of} from 'rxjs';
import {UserInfoService} from '../../../../../services/user-info.service';
import {ProfileSettingsService} from '../../profile-settings.service';
import {SettingsAvatarPickerComponent} from './settings-avatar-picker.component';

describe('SettingsAvatarPickerComponent', () => {
  it('resets the settings avatar without depending on the onboarding picker', () => {
    const profileSettings = jasmine.createSpyObj<ProfileSettingsService>('ProfileSettingsService', [
      'resetAvatar',
      'chooseDefaultAvatar',
    ]);
    profileSettings.resetAvatar.and.returnValue(of(null));
    const userInfo = jasmine.createSpyObj<UserInfoService>('UserInfoService', ['updateUserInfo']);

    TestBed.configureTestingModule({
      providers: [
        {provide: ProfileSettingsService, useValue: profileSettings},
        {provide: UserInfoService, useValue: userInfo},
        {provide: TuiNotificationService, useValue: {open: () => of(null)}},
      ],
    });

    const component = TestBed.runInInjectionContext(() => new SettingsAvatarPickerComponent());
    component.userInfo = {
      avatarUrl: 'https://example.test/assets/img/avatars/default/stag.png',
      username: 'kuzanoleg',
      premium: false,
    } as SettingsAvatarPickerComponent['userInfo'];

    (component as unknown as {useLetter(): void}).useLetter();

    expect(profileSettings.resetAvatar.calls.count()).toBe(1);
    expect(userInfo.updateUserInfo.calls.allArgs()).toEqual([[{avatarUrl: null}]]);
  });
});
