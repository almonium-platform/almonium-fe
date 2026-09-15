import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {PlanType, SetupStep, UserInfo} from '../../../models/userinfo.model';
import {UserInfoService} from '../../../services/user-info.service';
import {LanguageApiService} from '../../../services/language-api.service';
import {SharedLinkService} from '../shared-link.service';
import {SharedDeckView, SharedLinkViewerStatus, SharedWord} from '../shared-link.model';
import {SharedDeckComponent} from './shared-deck.component';

const WORDS: SharedWord[] = ['verschweigen', 'die Gleichgültigkeit', 'das Urteil'].map((entry, index) => ({
  id: `01990a4f-59d4-7000-8000-00000000001${index}`,
  entry,
  partOfSpeech: index === 0 ? 'verb' : 'noun',
  selectedSense: null,
  translations: [`meaning ${index}`],
  examples: [],
  sourceContext: `Sentence with ${entry}.`,
}));

describe('SharedDeckComponent', () => {
  it('gives a stranger the whole deck, the sign-up card and the footer, and no controls', async () => {
    const fixture = await createFixture({user: null});
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Shared deck');
    expect(element.textContent).toContain('Der Vorleser — chapters 1 to 4');
    expect(element.textContent).toContain('Three words in German.');
    expect(element.textContent).toContain('kuzanoleg');
    expect(element.querySelectorAll('app-shared-word').length).toBe(3);
    expect(element.textContent).toContain('Three words, scheduled');
    expect(element.textContent).toContain('Create an account');
    expect(element.querySelector('app-shared-footer')).not.toBeNull();
    expect(element.querySelector('.checkbox')).toBeNull();
    expect(element.querySelector('.attribution a')).toBeNull();
  });

  it('lets a learner of the language pick words, with held ones pre-unchecked and marked', async () => {
    const fixture = await createFixture({
      user: userInfo(false),
      viewer: {owner: false, hasLearner: true, heldWordIds: [WORDS[2].id], dueAmongHeld: 0},
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Add 2 words');
    expect(element.textContent).toContain('2 of 3 selected');
    expect(element.textContent).toContain('1 is already in your words');
    expect(element.querySelectorAll('.row.checked').length).toBe(2);
    expect(element.querySelectorAll('.row.held').length).toBe(1);
    expect(element.textContent).toContain('In your words');
    expect(element.querySelector('app-shared-footer')).toBeNull();

    clickByText(element, 'button', 'Clear');
    fixture.detectChanges();
    expect(element.textContent).toContain('Add words');
    expect(element.textContent).toContain('0 of 3 selected');

    element.querySelector<HTMLElement>('.row')?.click();
    fixture.detectChanges();
    expect(element.textContent).toContain('Add 1 word');
  });

  it('copies the chosen words and then reads back what is held', async () => {
    const fixture = await createFixture({
      user: userInfo(false),
      viewer: {owner: false, hasLearner: true, heldWordIds: [], dueAmongHeld: 0},
      viewerAfterAdd: {owner: false, hasLearner: true, heldWordIds: WORDS.map(word => word.id), dueAmongHeld: 2},
    });
    const element = fixture.nativeElement as HTMLElement;
    const service = TestBed.inject(SharedLinkService) as jasmine.SpyObj<SharedLinkService>;

    clickByText(element, 'button', 'Add 3 words');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.addFromDeck.calls.mostRecent().args).toEqual(['8fk2qaZZ', WORDS.map(word => word.id)]);
    expect(element.textContent).toContain('All three are in your words.');
    expect(element.textContent).toContain('Go to Review');
    expect(element.textContent).toContain('two are due');
    expect(element.querySelector('.checkbox')).toBeNull();
  });

  it('shows the owner their own page with the link banner and no add controls', async () => {
    const fixture = await createFixture({
      user: userInfo(true),
      viewer: {owner: true, hasLearner: true, heldWordIds: WORDS.map(word => word.id), dueAmongHeld: 0},
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Your deck. Anyone with this link sees this page.');
    expect(element.textContent).toContain('Manage the link');
    expect(element.textContent).not.toContain('Add');
    expect(element.textContent).not.toContain('In your words');
    expect(element.querySelector('.attribution')).toBeNull();
  });

  it('states the cap to a Free learner of another language and leaves the rows alone', async () => {
    const fixture = await createFixture({
      user: userInfo(false, LanguageCode.ES),
      viewer: {owner: false, hasLearner: false, heldWordIds: [], dueAmongHeld: 0},
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('These three words are German.');
    expect(element.textContent).toContain('You are learning Spanish, and Free covers one language at a time.');
    expect(element.textContent).toContain('See Member');
    expect(element.textContent).toContain('Keep reading the deck');
    expect(element.querySelectorAll('app-shared-word').length).toBe(3);
    expect(element.querySelector('.checkbox')).toBeNull();
  });

  it('offers a member the language and the words in one step', async () => {
    const fixture = await createFixture({
      user: userInfo(true, LanguageCode.ES),
      viewer: {owner: false, hasLearner: false, heldWordIds: [], dueAmongHeld: 0},
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('German would be your second');
    expect(element.textContent).toContain('Add German, then 3 words');
    expect(element.textContent).toContain('Not now');
  });

  it('shows a dead link without naming anyone', async () => {
    const fixture = await createFixture({user: null, view: {status: 'REVOKED', shareId: null, title: null, language: null, words: [], sharer: null}});
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('This link no longer works');
    expect(element.textContent).toContain('See what Almonium is');
    expect(element.textContent).not.toContain('kuzanoleg');
    expect(element.querySelector('img.almo')).not.toBeNull();
  });
});

function clickByText(root: HTMLElement, selector: string, text: string): void {
  const target = Array.from(root.querySelectorAll<HTMLElement>(selector))
    .find(element => element.textContent?.trim() === text);
  if (!target) throw new Error(`No ${selector} reading "${text}"`);
  target.click();
}

async function createFixture(options: {
  user: UserInfo | null;
  view?: SharedDeckView;
  viewer?: SharedLinkViewerStatus;
  viewerAfterAdd?: SharedLinkViewerStatus;
}) {
  const view: SharedDeckView = options.view ?? {
    status: 'ACTIVE',
    shareId: '8fk2qaZZ',
    title: 'Der Vorleser — chapters 1 to 4',
    language: LanguageCode.DE,
    words: WORDS,
    sharer: {username: 'kuzanoleg', avatarUrl: null, premium: true},
  };
  const service = jasmine.createSpyObj<SharedLinkService>('SharedLinkService', [
    'getDeck', 'deckViewer', 'addFromDeck', 'myDecks', 'setShareEnabled', 'deckLink',
  ]);
  service.getDeck.and.returnValue(of(view));
  const viewers = [options.viewer, options.viewerAfterAdd ?? options.viewer];
  let viewerCalls = 0;
  service.deckViewer.and.callFake(() => of(viewers[Math.min(viewerCalls++, 1)]!));
  service.addFromDeck.and.returnValue(of({added: 3, alreadyHeld: 0, firstDueAt: new Date()}));
  service.myDecks.and.returnValue(of([]));
  service.deckLink.and.returnValue('http://localhost:9999/d/8fk2qaZZ');

  await TestBed.configureTestingModule({
    imports: [SharedDeckComponent],
    providers: [
      provideRouter([]),
      {provide: ActivatedRoute, useValue: {paramMap: of(convertToParamMap({id: '8fk2qaZZ'}))}},
      {provide: SharedLinkService, useValue: service},
      {provide: UserInfoService, useValue: {loadUserInfo: () => of(options.user), fetchUserInfoFromServer: () => of(options.user)}},
      {provide: LanguageApiService, useValue: jasmine.createSpyObj<LanguageApiService>('LanguageApiService', ['setupLanguages'])},
      {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SharedDeckComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function userInfo(premium: boolean, language: LanguageCode = LanguageCode.DE): UserInfo {
  return UserInfo.fromJSON({
    id: '01990a4f-59d4-7000-8000-000000000001',
    username: 'familsubs',
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
      limits: premium ? {MAX_TARGET_LANGS: -1, MAX_FLUENT_LANGS: -1} : {MAX_TARGET_LANGS: 1, MAX_FLUENT_LANGS: 1},
      type: premium ? PlanType.YEARLY : PlanType.LIFETIME,
      autoRenewal: premium,
      startDate: '2026-03-18T00:00:00Z',
      endDate: premium ? '2027-03-18T00:00:00Z' : null,
    },
    premium,
    admin: false,
    learners: [{id: '01990a4f-59d4-7000-8000-000000000002', language, selfReportedLevel: 'B1', active: true}],
    interests: [],
    uiPreferences: {
      navbar: {discover: true, review: true, play: true, read: true, write: true, notifications: true, social: true, timer: true},
      profileMenu: {billing: false},
    },
  });
}
