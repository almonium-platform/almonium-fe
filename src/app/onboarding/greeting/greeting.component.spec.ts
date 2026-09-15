import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, of} from 'rxjs';
import {LanguageCode} from '../../models/language.enum';
import {CEFRLevel, PlanType, SetupStep, UserInfo} from '../../models/userinfo.model';
import {UserInfoService} from '../../services/user-info.service';
import {Interest} from '../../shared/interests/interest.model';
import {OnboardingService} from '../onboarding.service';
import {GreetingComponent} from './greeting.component';

describe('GreetingComponent', () => {
  it('leaves interests out of the summary when none were picked', async () => {
    const fixture = await createFixture(userInfo([]));
    expect(summary(fixture.nativeElement as HTMLElement)).toBe('German, B1. Almo has it noted; change any of it later.');
  });

  it('counts a single interest in the singular', async () => {
    const fixture = await createFixture(userInfo([{id: 1, name: 'Music'}]));
    expect(summary(fixture.nativeElement as HTMLElement)).toBe('German, B1, 1 interest. Almo has it noted; change any of it later.');
  });

  it('counts several interests in the plural', async () => {
    const fixture = await createFixture(userInfo([{id: 1, name: 'Music'}, {id: 2, name: 'Film'}, {id: 3, name: 'Food'}]));
    expect(summary(fixture.nativeElement as HTMLElement)).toBe('German, B1, 3 interests. Almo has it noted; change any of it later.');
  });
});

function summary(element: HTMLElement): string {
  return element.querySelector('p')?.textContent?.trim() ?? '';
}

async function createFixture(info: UserInfo) {
  await TestBed.configureTestingModule({
    imports: [GreetingComponent],
    providers: [
      {provide: UserInfoService, useValue: {userInfo$: new BehaviorSubject(info), updateUserInfo: () => undefined}},
      {provide: OnboardingService, useValue: {completeStep: () => of(undefined)}},
      {provide: Router, useValue: {navigateByUrl: () => Promise.resolve(true)}},
      {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(GreetingComponent);
  fixture.detectChanges();
  return fixture;
}

function userInfo(interests: Interest[]): UserInfo {
  return UserInfo.fromJSON({
    id: '01990a4f-59d4-7000-8000-000000000001',
    username: 'reader',
    email: 'reader@example.com',
    emailVerified: true,
    hidden: false,
    uiLang: null,
    avatarUrl: null,
    background: null,
    fluentLangs: [LanguageCode.EN],
    setupStep: SetupStep.GREETING,
    tags: [],
    subscription: {
      name: 'FREE',
      limits: {MAX_TARGET_LANGS: 1, MAX_FLUENT_LANGS: 1},
      type: PlanType.LIFETIME,
      autoRenewal: false,
      startDate: '2026-03-18T00:00:00Z',
      endDate: null,
    },
    premium: false,
    admin: false,
    learners: [{
      id: '01990a4f-59d4-7000-8000-000000000002',
      language: LanguageCode.DE,
      selfReportedLevel: CEFRLevel.B1,
      active: true,
    }],
    interests,
    uiPreferences: {
      navbar: {
        discover: true,
        review: true,
        play: true,
        read: true,
        write: true,
        notifications: true,
        social: true,
        timer: true,
      },
      profileMenu: {billing: true},
    },
  });
}
