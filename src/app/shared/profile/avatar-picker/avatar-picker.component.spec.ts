import {TestBed} from '@angular/core/testing';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of} from 'rxjs';
import {UserInfoService} from '../../../services/user-info.service';
import {ProfileSettingsService} from '../../../sections/settings/profile/profile-settings.service';
import {AvatarPickerComponent} from './avatar-picker.component';

describe('AvatarPickerComponent', () => {
  function configure(): void {
    const profileSettings = jasmine.createSpyObj<ProfileSettingsService>('ProfileSettingsService', [
      'resetAvatar',
      'chooseDefaultAvatar',
    ]);
    profileSettings.resetAvatar.and.returnValue(of(null));

    TestBed.configureTestingModule({
      providers: [
        {provide: ProfileSettingsService, useValue: profileSettings},
        {provide: UserInfoService, useValue: jasmine.createSpyObj<UserInfoService>('UserInfoService', ['updateUserInfo'])},
        {provide: TuiNotificationService, useValue: {open: () => of(null)}},
      ],
    });
  }

  function render(userInfo: Partial<AvatarPickerComponent['userInfo']>) {
    const fixture = TestBed.createComponent(AvatarPickerComponent);
    fixture.componentInstance.userInfo = userInfo as AvatarPickerComponent['userInfo'];
    fixture.detectChanges();
    return fixture;
  }

  it('seats the member star on the selected tile, and nowhere else', () => {
    configure();

    const fixture = render({
      avatarUrl: 'https://example.test/assets/img/avatars/default/stag.png',
      username: 'kuzanoleg',
      premium: true,
    });

    const element = fixture.nativeElement as HTMLElement;
    const stars = element.querySelectorAll('app-premium-star');
    expect(stars.length).toBe(1);
    expect(stars[0].closest('.tile')?.classList).toContain('selected');
    // The star hangs off the engraving; the schematic below carries no mark of its own.
    expect(stars[0].closest('.engraving')?.querySelector('.disc-large')).toBeTruthy();
  });

  it('draws no star for a free reader', () => {
    configure();

    const fixture = render({
      avatarUrl: 'https://example.test/assets/img/avatars/default/stag.png',
      username: 'kuzanoleg',
      premium: false,
    });

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('app-premium-star').length).toBe(0);
  });

  it('resets an animal avatar when the letter is selected', () => {
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

    const component = TestBed.runInInjectionContext(() => new AvatarPickerComponent());
    component.userInfo = {
      avatarUrl: 'https://example.test/assets/img/avatars/default/stag.png',
      username: 'kuzanoleg',
      premium: false,
    } as AvatarPickerComponent['userInfo'];

    (component as unknown as {useLetter(): void}).useLetter();

    expect(profileSettings.resetAvatar.calls.count()).toBe(1);
    expect(userInfo.updateUserInfo.calls.allArgs()).toEqual([[{avatarUrl: null}]]);
  });
});
