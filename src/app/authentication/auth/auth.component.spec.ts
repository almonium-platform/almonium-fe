import {ChangeDetectorRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute, Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core';
import {of} from 'rxjs';
import {AuthSettingsService} from '../../sections/settings/auth/auth-settings.service';
import {PopupTemplateStateService} from '../../shared/modals/popup-template/popup-template-state.service';
import {UserInfoService} from '../../services/user-info.service';
import {UrlService} from '../../services/url.service';
import {AuthComponent} from './auth.component';
import {AuthService} from './auth.service';

class TestAuthComponent extends AuthComponent {
  submit(): void {
    this.onSubmit();
  }

  get identified(): boolean {
    return this.emailIdentified;
  }

  get registered(): boolean {
    return this.accountExists;
  }
}

describe('AuthComponent email-first flow', () => {
  let component: TestAuthComponent;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'lookupEmailAccount',
      'login',
      'register',
    ]);

    TestBed.configureTestingModule({
      providers: [
        {provide: AuthService, useValue: authService},
        {provide: AuthSettingsService, useValue: {}},
        {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
        {provide: Router, useValue: {navigate: () => Promise.resolve(true), url: '/auth'}},
        {provide: ActivatedRoute, useValue: {}},
        {provide: ChangeDetectorRef, useValue: {markForCheck: () => undefined}},
        {provide: UserInfoService, useValue: {userInfo$: of(null)}},
        {provide: HttpClient, useValue: {}},
        {provide: UrlService, useValue: {}},
        {provide: PopupTemplateStateService, useValue: {close: () => undefined}},
      ],
    });

    component = TestBed.runInInjectionContext(() => new TestAuthComponent());
  });

  it('routes a registered email to sign in', () => {
    authService.lookupEmailAccount.and.returnValue(of({registered: true}));
    component.authForm.controls.emailValue.setValue('learner@example.com');

    component.submit();

    expect(authService.lookupEmailAccount.calls.mostRecent().args).toEqual(['learner@example.com']);
    expect(component.identified).toBeTrue();
    expect(component.registered).toBeTrue();
    expect(component.actionBtnText).toBe('Sign In');
    expect(component.authForm.controls.emailValue.disabled).toBeTrue();
  });

  it('routes an unregistered email to account creation', () => {
    authService.lookupEmailAccount.and.returnValue(of({registered: false}));
    component.authForm.controls.emailValue.setValue('new@example.com');

    component.submit();

    expect(component.identified).toBeTrue();
    expect(component.registered).toBeFalse();
    expect(component.actionBtnText).toBe('Create account');
  });
});
