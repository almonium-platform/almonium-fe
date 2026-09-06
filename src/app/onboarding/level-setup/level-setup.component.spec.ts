import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, of} from 'rxjs';
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

  it('drops the draft once the server has the level', async () => {
    seedDraft({levels: {DE: 'C1'}, interests: [{id: 1, name: 'Travel'}]});
    const fixture = await createFixture();

    host(fixture).querySelector('app-button')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(storedDraft()).toEqual({interests: [{id: 1, name: 'Travel'}]});
  });
});

function selectedLevel(fixture: ComponentFixture<LevelSetupComponent>): string {
  return host(fixture).querySelector('.level-option.selected code')?.textContent?.trim() ?? '';
}

function levelButton(fixture: ComponentFixture<LevelSetupComponent>, level: string): HTMLButtonElement {
  const buttons = Array.from(host(fixture).querySelectorAll<HTMLButtonElement>('.level-option'));
  return buttons.find(button => button.querySelector('code')?.textContent?.trim() === level)!;
}

function host(fixture: ComponentFixture<LevelSetupComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

async function createFixture(): Promise<ComponentFixture<LevelSetupComponent>> {
  const info = onboardingUserInfo(SetupStep.LEVEL);
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
