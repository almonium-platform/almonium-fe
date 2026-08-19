import {ChangeDetectorRef, TemplateRef} from '@angular/core';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core';
import {LanguageApiService} from '../../../services/language-api.service';
import {LanguageNameService} from '../../../services/language-name.service';
import {SupportedLanguagesService} from '../../../services/supported-langs.service';
import {TargetLanguageDropdownService} from '../../../services/target-language-dropdown.service';
import {UserInfoService} from '../../../services/user-info.service';
import {UrlService} from '../../../services/url.service';
import {UtilsService} from '../../../services/utils.service';
import {RecentAuthGuardService} from '../../../authentication/auth/recent-auth-guard.service';
import {PopupTemplateStateService} from '../../../shared/modals/popup-template/popup-template-state.service';
import {LangSettingsComponent} from './lang-settings.component';

describe('LangSettingsComponent', () => {
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
