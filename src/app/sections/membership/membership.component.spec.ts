import {HttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, of} from 'rxjs';
import {LanguageCode} from '../../models/language.enum';
import {PlanType, SetupStep, UserInfo} from '../../models/userinfo.model';
import {CardService} from '../../services/card.service';
import {PlanService} from '../../services/plan.service';
import {UserInfoService} from '../../services/user-info.service';
import {UrlService} from '../../services/url.service';
import {ReadService} from '../read/read.service';
import {MembershipComponent} from './membership.component';

describe('MembershipComponent', () => {
  it('shows a free member their real usage and the upgrade offer', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(false));
    const fixture = await createFixture(userInfo$, 42);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain("You're on Free");
    expect(element.textContent).toContain('42 / 100');
    expect(element.textContent).toContain('1 / 1');
    expect(element.textContent).toContain('Become a member');
  });

  it('shows a paid member account details without an upgrade pitch', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true));
    const fixture = await createFixture(userInfo$, 1428);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Premium member');
    expect(element.textContent).toContain('Renews 18 March 2027');
    expect(element.textContent).toContain('1428 · unlimited');
    expect(element.textContent).toContain('Manage plan, card and invoices');
    expect(element.textContent).not.toContain('Become a member');
  });
});

async function createFixture(userInfo$: BehaviorSubject<UserInfo>, savedWords: number) {
  const cardService = jasmine.createSpyObj<CardService>('CardService', ['getCardsInLanguage']);
  cardService.getCardsInLanguage.and.returnValue(of(Array.from({length: savedWords}, (_, index) => ({
    entry: `word-${index}`,
    language: 'DE',
    translations: [],
  }))));

  const planService = jasmine.createSpyObj<PlanService>('PlanService', [
    'getPlans',
    'subscribeToPlan',
    'accessCustomerPortal',
  ]);
  planService.getPlans.and.returnValue(of([
    {id: 2, name: 'PREMIUM', type: 'MONTHLY', description: '', price: 12},
    {id: 3, name: 'PREMIUM', type: 'YEARLY', description: '', price: 120},
  ]));

  const readService = jasmine.createSpyObj<ReadService>('ReadService', ['getBookImportQuota']);
  readService.getBookImportQuota.and.returnValue(of({
    limit: 3,
    used: 1,
    periodStartsAt: '2027-03-01T00:00:00Z',
    periodEndsAt: '2027-04-01T00:00:00Z',
  }));

  await TestBed.configureTestingModule({
    imports: [MembershipComponent],
    providers: [
      {provide: UserInfoService, useValue: {userInfo$, fetchUserInfoFromServer: () => of(userInfo$.value)}},
      {provide: PlanService, useValue: planService},
      {provide: CardService, useValue: cardService},
      {provide: ReadService, useValue: readService},
      {provide: HttpClient, useValue: {get: () => of({capacity: 50, claimed: 12})}},
      {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
      {provide: ActivatedRoute, useValue: {queryParams: of({})}},
      {provide: UrlService, useValue: {clearUrl: () => undefined}},
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(MembershipComponent);
  fixture.detectChanges();
  return fixture;
}

function userInfo(premium: boolean): UserInfo {
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
    setupStep: SetupStep.COMPLETED,
    tags: [],
    subscription: {
      name: premium ? 'PREMIUM' : 'FREE',
      limits: premium
        ? {MAX_TARGET_LANGS: -1, MAX_FLUENT_LANGS: -1, MAX_BOOK_IMPORTS_PER_MONTH: 3}
        : {MAX_TARGET_LANGS: 1, MAX_FLUENT_LANGS: 1},
      type: premium ? PlanType.YEARLY : PlanType.LIFETIME,
      autoRenewal: premium,
      startDate: '2026-03-18T00:00:00Z',
      endDate: premium ? '2027-03-18T00:00:00Z' : null,
    },
    premium,
    admin: false,
    learners: [{
      id: '01990a4f-59d4-7000-8000-000000000002',
      language: LanguageCode.DE,
      selfReportedLevel: 'B1',
      active: true,
    }],
    interests: [],
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
