import {ChangeDetectorRef, TemplateRef} from '@angular/core';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core';
import {of} from 'rxjs';
import {LanguageApiService} from '../../../services/language-api.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';
import {UserInfoService} from '../../../services/user-info.service';
import {UrlService} from '../../../services/url.service';
import {UtilsService} from '../../../services/utils.service';
import {RecentAuthGuardService} from '../../../authentication/auth/recent-auth-guard.service';
import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {LanguageCode} from '../../../models/language.enum';
import {CEFRLevel, Learner, UserInfo} from '../../../models/userinfo.model';
import {LangSettingsComponent} from './lang-settings.component';

describe('LangSettingsComponent', () => {
  it('keeps the selected CEFR level when the save returns no content', () => {
    const originalLearner = new Learner('learner-1', LanguageCode.DE, CEFRLevel.A1, true);
    const languageApi = jasmine.createSpyObj<LanguageApiService>('LanguageApiService', ['updateLearner']);
    const userInfo = jasmine.createSpyObj<UserInfoService>('UserInfoService', ['updateUserInfo']);
    languageApi.updateLearner.and.returnValue(of(null));

    TestBed.configureTestingModule({
      providers: [
        {provide: LanguageApiService, useValue: languageApi},
        {provide: LanguageNameService, useValue: {}},
        {provide: UserInfoService, useValue: userInfo},
        {provide: TuiNotificationService, useValue: {}},
        {provide: ChangeDetectorRef, useValue: {}},
        {provide: TargetLanguageDropdownService, useValue: {}},
        {provide: PopupTemplateStateService, useValue: {}},
        {provide: ActivatedRoute, useValue: {}},
        {provide: UrlService, useValue: {}},
        {provide: RecentAuthGuardService, useValue: {}},
        {provide: SupportedLanguagesService, useValue: {}},
        {provide: UtilsService, useValue: {}},
      ],
    });

    const component = TestBed.runInInjectionContext(() => new LangSettingsComponent());
    const languageSettings = component as unknown as {
      learners: Learner[];
      onCefrLevelChange(learner: Learner, level: CEFRLevel): void;
    };
    languageSettings.learners = [originalLearner];

    languageSettings.onCefrLevelChange(originalLearner, CEFRLevel.B2);

    expect(languageApi.updateLearner.calls.allArgs()).toEqual([[LanguageCode.DE, {level: CEFRLevel.B2}]]);
    expect(languageSettings.learners[0].selfReportedLevel).toBe(CEFRLevel.B2);
    expect(userInfo.updateUserInfo.calls.allArgs()).toEqual([[{learners: languageSettings.learners}]]);
  });

  function activeStatusHarness(fetched: UserInfo | null) {
    const languageApi = jasmine.createSpyObj<LanguageApiService>(
      'LanguageApiService', ['updateLearner', 'getActiveLanguagePolicy']);
    const userInfo = jasmine.createSpyObj<UserInfoService>(
      'UserInfoService', ['updateUserInfo', 'fetchUserInfoFromServer']);
    const dropdown = jasmine.createSpyObj<TargetLanguageDropdownService>(
      'TargetLanguageDropdownService', ['initializeLanguages', 'removeTargetLanguage']);
    languageApi.updateLearner.and.returnValue(of(null));
    languageApi.getActiveLanguagePolicy.and.returnValue(of({
      allowance: 1, allowanceWithoutPlan: 1, nextSwitchAllowedAt: null, languages: [],
    }));
    userInfo.fetchUserInfoFromServer.and.returnValue(of(fetched));

    TestBed.configureTestingModule({
      providers: [
        {provide: LanguageApiService, useValue: languageApi},
        {provide: LanguageNameService, useValue: {}},
        {provide: UserInfoService, useValue: userInfo},
        {provide: TuiNotificationService, useValue: {}},
        {provide: ChangeDetectorRef, useValue: {}},
        {provide: TargetLanguageDropdownService, useValue: dropdown},
        {provide: PopupTemplateStateService, useValue: {}},
        {provide: ActivatedRoute, useValue: {}},
        {provide: UrlService, useValue: {}},
        {provide: RecentAuthGuardService, useValue: {}},
        {provide: SupportedLanguagesService, useValue: {}},
        {provide: UtilsService, useValue: {}},
      ],
    });

    const component = TestBed.runInInjectionContext(() => new LangSettingsComponent()) as unknown as {
      learners: Learner[];
      onToggleActiveStatus(active: boolean, learner: Learner): void;
    };
    return {component, languageApi, userInfo, dropdown};
  }

  it('re-reads the account after making a language active, since the server picks which one it sets aside', () => {
    const german = new Learner('learner-de', LanguageCode.DE, CEFRLevel.B1, true);
    const english = new Learner('learner-en', LanguageCode.EN, CEFRLevel.B2, false);
    const {component, languageApi, userInfo, dropdown} = activeStatusHarness({} as UserInfo);
    component.learners = [german, english];

    component.onToggleActiveStatus(true, english);

    expect(languageApi.updateLearner.calls.allArgs()).toEqual([[LanguageCode.EN, {active: true}]]);
    expect(userInfo.fetchUserInfoFromServer.calls.count()).toBe(1);
    expect(userInfo.updateUserInfo.calls.count()).toBe(0);
    expect(dropdown.initializeLanguages.calls.count()).toBe(1);
  });

  it('pushes the local flip when the re-read fails, so the toggle never reverts a saved change', () => {
    const german = new Learner('learner-de', LanguageCode.DE, CEFRLevel.B1, true);
    const english = new Learner('learner-en', LanguageCode.EN, CEFRLevel.B2, false);
    const {component, userInfo} = activeStatusHarness(null);
    component.learners = [german, english];

    component.onToggleActiveStatus(true, english);

    expect(english.active).toBeTrue();
    expect(userInfo.updateUserInfo.calls.allArgs()).toEqual([[{learners: component.learners}]]);
  });

  it('sets a language aside locally without a round trip, since that touches one row', () => {
    const german = new Learner('learner-de', LanguageCode.DE, CEFRLevel.B1, true);
    const english = new Learner('learner-en', LanguageCode.EN, CEFRLevel.B2, true);
    const {component, userInfo, dropdown} = activeStatusHarness(null);
    component.learners = [german, english];

    component.onToggleActiveStatus(false, english);

    expect(english.active).toBeFalse();
    expect(userInfo.fetchUserInfoFromServer.calls.count()).toBe(0);
    expect(userInfo.updateUserInfo.calls.allArgs()).toEqual([[{learners: component.learners}]]);
    expect(dropdown.removeTargetLanguage.calls.allArgs()).toEqual([[LanguageCode.EN]]);
  });

  it('keeps the add-language popup open while interacting with portaled dropdowns', fakeAsync(() => {
    const popupState = jasmine.createSpyObj<PopupTemplateStateService>('PopupTemplateStateService', ['open']);
    const content = {} as TemplateRef<unknown>;

    TestBed.configureTestingModule({
      providers: [
        {provide: LanguageApiService, useValue: {}},
        {provide: LanguageNameService, useValue: {}},
        {provide: UserInfoService, useValue: {}},
        {provide: TuiNotificationService, useValue: {}},
        {provide: ChangeDetectorRef, useValue: {}},
        {provide: TargetLanguageDropdownService, useValue: {}},
        {provide: PopupTemplateStateService, useValue: popupState},
        {provide: ActivatedRoute, useValue: {}},
        {provide: UrlService, useValue: {}},
        {provide: RecentAuthGuardService, useValue: {}},
        {provide: SupportedLanguagesService, useValue: {}},
        {provide: UtilsService, useValue: {}},
      ],
    });

    const component = TestBed.runInInjectionContext(() => new LangSettingsComponent());
    component.languageSetupComponent = {content} as never;

    (component as unknown as {openLangSetupPopup(): void}).openLangSetupPopup();
    tick(50);

    expect(popupState.open.calls.count()).toBe(1);
    expect(popupState.open.calls.mostRecent().args).toEqual([content, 'add-target-lang', false, true]);
  }));
});
