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
import {CEFRLevel, Learner} from '../../../models/userinfo.model';
import {LangSettingsComponent} from './lang-settings.component';

describe('LangSettingsComponent', () => {
  it('uses the saved learner response as the CEFR level source of truth', () => {
    const originalLearner = new Learner('learner-1', LanguageCode.DE, CEFRLevel.A1, true);
    const savedLearner = new Learner('learner-1', LanguageCode.DE, CEFRLevel.B2, true);
    const languageApi = jasmine.createSpyObj<LanguageApiService>('LanguageApiService', ['updateLearner']);
    const userInfo = jasmine.createSpyObj<UserInfoService>('UserInfoService', ['updateUserInfo']);
    languageApi.updateLearner.and.returnValue(of(savedLearner));

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

    expect(languageApi.updateLearner).toHaveBeenCalledWith(LanguageCode.DE, {level: CEFRLevel.B2});
    expect(languageSettings.learners).toEqual([savedLearner]);
    expect(userInfo.updateUserInfo).toHaveBeenCalledWith({learners: [savedLearner]});
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
