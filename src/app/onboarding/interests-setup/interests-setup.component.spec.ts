import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, of} from 'rxjs';
import {SetupStep, UserInfo} from '../../models/userinfo.model';
import {StaticInfoService} from '../../services/static-info.service';
import {UserInfoService} from '../../services/user-info.service';
import {Interest} from '../../shared/interests/interest.model';
import {OnboardingService} from '../onboarding.service';
import {ONBOARDING_DRAFTS_KEY, onboardingUserInfo, seedDraft, storedDraft} from '../onboarding-spec-fixtures';
import {InterestsSetupComponent} from './interests-setup.component';

const TRAVEL: Interest = {id: 1, name: 'Travel'};
const SPORTS: Interest = {id: 2, name: 'Sports'};
const HISTORY: Interest = {id: 3, name: 'History'};

describe('InterestsSetupComponent', () => {
  afterEach(() => window.localStorage.removeItem(ONBOARDING_DRAFTS_KEY));

  it('starts from the interests the server already has', async () => {
    const fixture = await createFixture([SPORTS]);
    expect(selectedNames(fixture)).toEqual(['Sports']);
  });

  it('resumes with the interests picked before a drop-off', async () => {
    seedDraft({interests: [TRAVEL, HISTORY]});
    const fixture = await createFixture([SPORTS]);
    expect(selectedNames(fixture)).toEqual(['Travel', 'History']);
  });

  it('remembers a pick as soon as it is made', async () => {
    const fixture = await createFixture([]);

    chipInput(fixture, 'Sports').click();
    fixture.detectChanges();

    expect(selectedNames(fixture)).toEqual(['Sports']);
    expect(storedDraft()).toEqual({interests: [SPORTS]});
  });

  it('drops the draft once the server has the interests', async () => {
    seedDraft({interests: [TRAVEL], levels: {DE: 'C1'}});
    const fixture = await createFixture([]);

    host(fixture).querySelector('app-button')!.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(storedDraft()).toEqual({levels: {DE: 'C1'}});
  });
});

function selectedNames(fixture: ComponentFixture<InterestsSetupComponent>): string[] {
  const labels = host(fixture).querySelectorAll<HTMLElement>('label.selected');
  return Array.from(labels).map(label => label.textContent?.trim() ?? '');
}

function chipInput(fixture: ComponentFixture<InterestsSetupComponent>, name: string): HTMLInputElement {
  const labels = Array.from(host(fixture).querySelectorAll<HTMLLabelElement>('label'));
  return labels.find(label => label.textContent?.trim() === name)!.querySelector('input')!;
}

function host(fixture: ComponentFixture<InterestsSetupComponent>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

async function createFixture(saved: Interest[]): Promise<ComponentFixture<InterestsSetupComponent>> {
  const info = onboardingUserInfo(SetupStep.INTERESTS, saved);
  const userInfo$ = new BehaviorSubject<UserInfo | null>(info);
  await TestBed.configureTestingModule({
    imports: [InterestsSetupComponent],
    providers: [
      {provide: UserInfoService, useValue: {userInfo$, currentUserInfo: info, updateUserInfo: () => undefined}},
      {provide: OnboardingService, useValue: {saveInterests: () => of(undefined)}},
      {provide: StaticInfoService, useValue: {getInterests: () => of([TRAVEL, SPORTS, HISTORY].map(i => ({...i})))}},
      {provide: Router, useValue: {navigateByUrl: () => Promise.resolve(true)}},
      {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(InterestsSetupComponent);
  fixture.componentInstance.currentInterests = saved;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}
