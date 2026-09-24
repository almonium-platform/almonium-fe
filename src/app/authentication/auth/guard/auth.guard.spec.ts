import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {of, throwError} from 'rxjs';
import {SetupStep, UserInfo} from '../../../models/userinfo.model';
import {ReturnPathService} from '../../../services/return-path.service';
import {UserInfoService} from '../../../services/user-info.service';
import {authGuard} from './auth.guard';

describe('authGuard', () => {
  let userInfoService: jasmine.SpyObj<UserInfoService>;
  let router: jasmine.SpyObj<Router>;
  let returnPath: jasmine.SpyObj<ReturnPathService>;
  const redirectTree = {} as UrlTree;

  beforeEach(() => {
    userInfoService = jasmine.createSpyObj<UserInfoService>('UserInfoService', ['loadUserInfo']);
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(redirectTree);
    returnPath = jasmine.createSpyObj<ReturnPathService>('ReturnPathService', ['remember']);

    TestBed.configureTestingModule({
      providers: [
        {provide: UserInfoService, useValue: userInfoService},
        {provide: Router, useValue: router},
        {provide: ReturnPathService, useValue: returnPath},
      ],
    });
  });

  it('remembers where a signed-out visitor was headed before sending them to sign in', async () => {
    userInfoService.loadUserInfo.and.returnValue(of(null));

    expect(await runGuard('/settings/auth')).toBe(redirectTree);
    expect(router.createUrlTree.calls.allArgs()).toEqual([[['/auth']]]);
    expect(returnPath.remember.calls.allArgs()).toEqual([['/settings/auth']]);
  });

  it('remembers the route when the session lookup fails outright', async () => {
    userInfoService.loadUserInfo.and.returnValue(throwError(() => new Error('offline')));

    expect(await runGuard('/settings/auth')).toBe(redirectTree);
    expect(returnPath.remember.calls.allArgs()).toEqual([['/settings/auth']]);
  });

  it('lets a completed account through without touching the remembered path', async () => {
    userInfoService.loadUserInfo.and.returnValue(of({setupStep: SetupStep.COMPLETED} as UserInfo));

    expect(await runGuard('/settings/auth')).toBeTrue();
    expect(returnPath.remember.calls.count()).toBe(0);
  });

  it('sends an unfinished account to onboarding, which is not a destination to come back to', async () => {
    userInfoService.loadUserInfo.and.returnValue(of({setupStep: SetupStep.PROFILE} as UserInfo));

    expect(await runGuard('/settings/auth')).toBe(redirectTree);
    expect(router.createUrlTree.calls.allArgs()).toEqual([[['/onboarding']]]);
    expect(returnPath.remember.calls.count()).toBe(0);
  });

  function runGuard(url: string): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => authGuard({} as ActivatedRouteSnapshot, {url} as RouterStateSnapshot) as Promise<boolean | UrlTree>,
    );
  }
});
