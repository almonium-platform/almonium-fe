import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {BehaviorSubject, of} from 'rxjs';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {UserInfoService} from '../../services/user-info.service';
import {ProfileSettingsService} from '../../sections/settings/profile/profile-settings.service';
import {UsernameComponent} from './username.component';

describe('UsernameComponent', () => {
  const userInfo$ = new BehaviorSubject<unknown>(null);
  const profileSettingsService = {
    checkUsernameAvailability: jasmine.createSpy('checkUsernameAvailability'),
    updateUsername: jasmine.createSpy('updateUsername'),
  };

  beforeEach(async () => {
    userInfo$.next(null);
    profileSettingsService.checkUsernameAvailability.calls.reset();
    profileSettingsService.updateUsername.calls.reset();

    await TestBed.configureTestingModule({
      imports: [UsernameComponent],
      providers: [
        {provide: UserInfoService, useValue: {userInfo$, updateUserInfo: jasmine.createSpy('updateUserInfo')}},
        {provide: ProfileSettingsService, useValue: profileSettingsService},
        {provide: TuiNotificationService, useValue: {open: () => of(null)}},
      ],
    }).compileComponents();
  });

  it('shows the current username as available without asking whether it conflicts with itself', fakeAsync(() => {
    const fixture = TestBed.createComponent(UsernameComponent);
    fixture.detectChanges();
    userInfo$.next({username: 'kuzanoleg'});
    tick();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input');
    const availability = element.querySelector<HTMLElement>('.availability');
    expect(input?.value).toBe('kuzanoleg');
    expect(availability?.textContent?.trim()).toBe('available');
    expect(profileSettingsService.checkUsernameAvailability).not.toHaveBeenCalled();
  }));

  it('shows green availability feedback from the backend response', fakeAsync(() => {
    profileSettingsService.checkUsernameAvailability.and.returnValue(of({available: true}));
    const fixture = TestBed.createComponent(UsernameComponent);
    fixture.detectChanges();
    userInfo$.next({username: 'kuzanoleg'});
    tick();

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    if (!input) {
      return;
    }
    input.value = 'new_reader';
    input.dispatchEvent(new Event('input'));
    tick(600);
    fixture.detectChanges();

    const availability = element.querySelector<HTMLElement>('.availability');
    expect(availability).not.toBeNull();
    expect(profileSettingsService.checkUsernameAvailability).toHaveBeenCalledWith('new_reader');
    expect(availability?.textContent?.trim()).toBe('available');
    expect(availability?.classList).toContain('available');
  }));
});
