import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {of} from 'rxjs';
import {UserInfo} from '../../../models/userinfo.model';
import {UserInfoService} from '../../../services/user-info.service';
import {unauthGuard} from './unauth.guard';

describe('unauthGuard', () => {
  let userInfoService: jasmine.SpyObj<UserInfoService>;
  let router: jasmine.SpyObj<Router>;
  const homeTree = {} as UrlTree;

  beforeEach(() => {
    userInfoService = jasmine.createSpyObj<UserInfoService>('UserInfoService', ['loadUserInfo']);
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(homeTree);

    TestBed.configureTestingModule({
      providers: [
        {provide: UserInfoService, useValue: userInfoService},
        {provide: Router, useValue: router},
      ],
    });
  });

  it('allows the auth route when the server session is unauthenticated', async () => {
    userInfoService.loadUserInfo.and.returnValue(of(null));

    expect(await runGuard()).toBeTrue();
    expect(router.createUrlTree.calls.count()).toBe(0);
  });

  it('redirects only after the user service verifies a session', async () => {
    userInfoService.loadUserInfo.and.returnValue(of({} as UserInfo));

    expect(await runGuard()).toBe(homeTree);
    expect(router.createUrlTree.calls.allArgs()).toEqual([[['/home']]]);
  });

  function runGuard(): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(
      () => unauthGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot) as Promise<boolean | UrlTree>,
    );
  }
});
