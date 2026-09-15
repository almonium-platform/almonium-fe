import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, of} from 'rxjs';
import {LanguageCode} from '../../models/language.enum';
import {SetupStep, UserInfo} from '../../models/userinfo.model';
import {UserInfoService} from '../../services/user-info.service';
import {OnboardingService} from '../onboarding.service';
import {ONBOARDING_DRAFTS_KEY, onboardingUserInfo, seedDraft, storedDraft} from '../onboarding-spec-fixtures';
import {LevelSetupComponent} from './level-setup.component';

describe('LevelSetupComponent', () => {
  afterEach(() => window.localStorage.removeItem(ONBOARDING_DRAFTS_KEY));

  it('starts from the level the server already has', async () => {
    const fixture = await createFixture();
    expect(selectedLevel(fixture)).toBe('B1');
  });

  it('resumes with the level picked before a drop-off', async () => {
    seedDraft({levels: {DE: 'C1'}});
    const fixture = await createFixture();
    expect(selectedLevel(fixture)).toBe('C1');
  });

  it('remembers a pick as soon as it is made', async () => {
    const fixture = await createFixture();

    levelButton(fixture, 'A2').click();
    fixture.detectChanges();

    expect(selectedLevel(fixture)).toBe('A2');
    expect(storedDraft()).toEqual({levels: {DE: 'A2'}});
  });

  it('asks once per language, and explains the choice only once', async () => {
    const fixture = await createFixture([LanguageCode.DE, LanguageCode.FR, LanguageCode.ES]);

    const questions = host(fixture).querySelectorAll('.level-question');
    expect(Array.from(questions).map(question => question.querySelector('h1')!.textContent.trim()))
      .toEqual(['How much German can you read?', 'How much French can you read?', 'How much Spanish can you read?']);
    expect(host(fixture).querySelectorAll('.level-question p').length).toBe(1);
    expect(questions[0].querySelector('p')).not.toBeNull();
  });

  it('keeps each language on its own level', async () => {
    const fixture = await createFixture([LanguageCode.DE, LanguageCode.FR]);

    levelButton(fixture, 'A2', 1).click();
    fixture.detectChanges();

    expect(selectedLevel(fixture, 0)).toBe('B1');
    expect(selectedLevel(fixture, 1)).toBe('A2');
    expect(storedDraft()).toEqual({levels: {DE: 'B1', FR: 'A2'}});
  });

  it('drops the draft once the server has the level', async () => {
    seedDraft({levels: {DE: 'C1'}, interests: [{id: 1, name: 'Travel'}]});
    const fixture = await createFixture();

    host(fixture).querySelector('app-button')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(storedDraft()).toEqual({interests: [{id: 1, name: 'Travel'}]});
  });
});

function selectedLevel(fixture: ComponentFixture<LevelSetupComponent>, question = 0): string {
  return questionAt(fixture, question).querySelector('.level-option.selected code')?.textContent?.trim() ?? '';
}

function levelButton(fixture: ComponentFixture<LevelSetupComponent>, level: string, question = 0): HTMLButtonElement {
  const buttons = Array.from(questionAt(fixture, question).querySelectorAll<HTMLButtonElement>('.level-option'));
  return buttons.find(button => button.querySelector('code')?.textContent?.trim() === level)!;
}

function questionAt(fixture: ComponentFixture<LevelSetupComponent>, question: number): HTMLElement {
  return host(fixture).querySelectorAll<HTMLElement>('.level-question')[question];
}

function host(fixture: ComponentFixture<LevelSetupComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

async function createFixture(languages: LanguageCode[] = [LanguageCode.DE]): Promise<ComponentFixture<LevelSetupComponent>> {
  const info = onboardingUserInfo(SetupStep.LEVEL);
  info.learners = languages.map((language, index) => ({...info.learners[0], id: `learner-${index}`, language}));
  const userInfo$ = new BehaviorSubject<UserInfo | null>(info);
  await TestBed.configureTestingModule({
    imports: [LevelSetupComponent],
    providers: [
      {provide: UserInfoService, useValue: {userInfo$, currentUserInfo: info, updateUserInfo: () => undefined}},
      {provide: OnboardingService, useValue: {setupLevels: () => of(undefined)}},
      {provide: Router, useValue: {navigateByUrl: () => Promise.resolve(true)}},
      {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LevelSetupComponent);
  fixture.detectChanges();
  return fixture;
}
