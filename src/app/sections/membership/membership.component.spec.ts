import {HttpClient} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, of} from 'rxjs';
import {LanguageCode} from '../../models/language.enum';
import {PlanType, SetupStep, SubscriptionDto, UserInfo} from '../../models/userinfo.model';
import {CadenceChangeKind, CadenceChangePreview} from '../../models/cadence-change.model';
import {CardService} from '../../services/card.service';
import {PlanService} from '../../services/plan.service';
import {UserInfoService} from '../../services/user-info.service';
import {UrlService} from '../../services/url.service';
import {ReadService} from '../read/read.service';
import {MembershipComponent} from './membership.component';

describe('MembershipComponent', () => {
  beforeEach(() => localStorage.removeItem('almonium.annualOfferSeen'));

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
    expect(element.textContent).toContain('Manage card and invoices');
    expect(element.textContent).not.toContain('Become a member');
  });

  it('shows a pending cadence change with the undo beside it', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true, {
      scheduledChange: {type: PlanType.MONTHLY, effectiveAt: '2027-09-04T00:00:00Z'},
    }));
    const fixture = await createFixture(userInfo$, 10);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Scheduled change');
    expect(element.textContent).toContain('Monthly from 4 September 2027');
    expect(element.textContent).toContain('Keep annual instead');
    // A change is already pending, so the page does not offer to start a second one.
    expect(element.textContent).not.toContain('Switch to monthly billing');
  });

  it('undoes a pending change in one action', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true, {
      scheduledChange: {type: PlanType.MONTHLY, effectiveAt: '2027-09-04T00:00:00Z'},
    }));
    const fixture = await createFixture(userInfo$, 10);
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.scheduled-row .undo')?.click();

    const planService = TestBed.inject(PlanService) as jasmine.SpyObj<PlanService>;
    expect(planService.undoCadenceChange.calls.any()).toBeTrue();
  });

  it('opens the switch with the figures the server returned, and none of its own', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true, {founder: true}));
    const fixture = await createFixture(userInfo$, 10);
    const element = fixture.nativeElement as HTMLElement;

    clickByText(element, 'button', 'Switch to monthly billing');
    fixture.detectChanges();

    expect(element.textContent).toContain('Switch to monthly billing');
    expect(element.textContent).toContain('$0.00');
    expect(element.textContent).toContain('Annual plan runs until');
    expect(element.textContent).toContain('4 September 2027');
    expect(element.textContent).toContain("You've already paid through 4 September 2027");
    expect(element.textContent).toContain('Your founding-member price stays locked');
  });

  it('leads with the refund while the annual payment is inside the guarantee', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true, {founder: true}));
    const fixture = await createFixture(userInfo$, 10, {preview: insideGuaranteePreview()});
    const element = fixture.nativeElement as HTMLElement;

    clickByText(element, 'button', 'Switch to monthly billing');
    fixture.detectChanges();

    expect(element.textContent).toContain("You're still within your 14-day guarantee.");
    expect(element.textContent).toContain('Refund to your card');
    expect(element.textContent).toContain('$80.00');
    expect(element.textContent).toContain('Today');
    expect(element.textContent).toContain('Refund and switch to monthly');
    expect(element.textContent).toContain('Schedule the switch for September 2027');
    expect(element.textContent).toContain('Either way you keep your founding-member price.');
  });

  it('warns a founder that their price does not come back, inside the cancellation step', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true, {founder: true}));
    const fixture = await createFixture(userInfo$, 10);
    const element = fixture.nativeElement as HTMLElement;

    clickByText(element, 'button', 'Cancel subscription');
    fixture.detectChanges();

    expect(element.textContent).toContain('Cancel your subscription?');
    expect(element.textContent).toContain('You keep everything until 18 March 2027');
    expect(element.textContent).toContain("Founding-member pricing ends with your subscription");
    expect(element.textContent).toContain('Keep it');
  });

  it('leaves the founder warning out for a member who is not one', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true));
    const fixture = await createFixture(userInfo$, 10);
    const element = fixture.nativeElement as HTMLElement;

    clickByText(element, 'button', 'Cancel subscription');
    fixture.detectChanges();

    expect(element.textContent).toContain('Cancel your subscription?');
    expect(element.textContent).not.toContain('Founding-member pricing ends');
  });

  it('offers annual once the member has earned it, and not again after they answer', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true, {type: PlanType.MONTHLY}));
    const fixture = await createFixture(userInfo$, 10, {httpResponse: {eligible: true}});
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Switch to annual and save');
    expect(element.textContent).toContain('$120 a year comes to $10 a month, instead of $12.');
    expect(element.textContent).not.toContain('months free');

    clickByText(element, 'button', 'Keep monthly');
    fixture.detectChanges();

    expect(element.textContent).not.toContain('Switch to annual and save');
    expect(localStorage.getItem('almonium.annualOfferSeen')).toBe('true');
  });

  it('stays quiet for a member who has not earned the offer', async () => {
    const userInfo$ = new BehaviorSubject(userInfo(true, {type: PlanType.MONTHLY}));
    const fixture = await createFixture(userInfo$, 10, {httpResponse: {eligible: false}});

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Switch to annual and save');
  });
});

function clickByText(root: HTMLElement, selector: string, text: string): void {
  const target = Array.from(root.querySelectorAll<HTMLElement>(selector))
    .find(element => element.textContent?.trim().includes(text));
  if (!target) throw new Error(`No ${selector} containing "${text}"`);
  target.click();
}

function annualToMonthlyPreview(): CadenceChangePreview {
  return {
    currentType: PlanType.YEARLY,
    targetType: PlanType.MONTHLY,
    targetPriceMinorUnits: 800,
    founderPrice: true,
    currencyCode: 'USD',
    currentPeriodEndsAt: new Date('2027-09-04T00:00:00Z'),
    options: [{
      kind: CadenceChangeKind.SCHEDULED,
      recommended: true,
      dueNowMinorUnits: 0,
      creditMinorUnits: null,
      refundMinorUnits: null,
      effectiveAt: new Date('2027-09-04T00:00:00Z'),
      nextBilledAt: new Date('2027-09-04T00:00:00Z'),
    }],
  };
}

function insideGuaranteePreview(): CadenceChangePreview {
  const scheduled = annualToMonthlyPreview();
  return {
    ...scheduled,
    options: [
      {
        kind: CadenceChangeKind.REFUND_AND_SWITCH,
        recommended: true,
        dueNowMinorUnits: 800,
        creditMinorUnits: null,
        refundMinorUnits: 8000,
        effectiveAt: new Date(),
        nextBilledAt: new Date('2026-10-05T00:00:00Z'),
      },
      ...scheduled.options,
    ],
  };
}

async function createFixture(
  userInfo$: BehaviorSubject<UserInfo>,
  savedWords: number,
  options: {
    preview?: CadenceChangePreview;
    httpResponse?: unknown;
  } = {},
) {
  const preview = options.preview ?? annualToMonthlyPreview();
  const httpResponse = options.httpResponse ?? {capacity: 20, claimed: 12};
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
    'previewCadenceChange',
    'changeCadence',
    'undoCadenceChange',
    'cancelSubscription',
  ]);
  planService.previewCadenceChange.and.returnValue(of(preview));
  planService.changeCadence.and.returnValue(of(undefined));
  planService.undoCadenceChange.and.returnValue(of(undefined));
  planService.cancelSubscription.and.returnValue(of(undefined));
  planService.getPlans.and.returnValue(of([
    {id: 2, name: 'PREMIUM', type: 'MONTHLY', description: '', price: 12, founderPrice: 8, limits: {}},
    {id: 3, name: 'PREMIUM', type: 'YEARLY', description: '', price: 120, founderPrice: 80, limits: {}},
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
      {provide: HttpClient, useValue: {get: () => of(httpResponse)}},
      {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
      {provide: ActivatedRoute, useValue: {queryParams: of({})}},
      {provide: UrlService, useValue: {clearUrl: () => undefined}},
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(MembershipComponent);
  fixture.detectChanges();
  return fixture;
}

function userInfo(premium: boolean, subscription: Partial<SubscriptionDto> = {}): UserInfo {
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
      ...subscription,
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
