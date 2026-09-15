import {TestBed} from '@angular/core/testing';
import {LanguageCode} from '../models/language.enum';
import {CEFRLevel} from '../models/userinfo.model';
import {UserInfoService} from '../services/user-info.service';
import {OnboardingDraftService} from './onboarding-draft.service';

describe('OnboardingDraftService', () => {
  const draftsKey = 'onboarding_drafts';
  let currentUserInfo: {id: string} | null;
  let service: OnboardingDraftService;

  beforeEach(() => {
    currentUserInfo = {id: 'user-1'};
    TestBed.configureTestingModule({
      providers: [{provide: UserInfoService, useValue: {get currentUserInfo() { return currentUserInfo; }}}],
    });
    service = TestBed.inject(OnboardingDraftService);
  });

  afterEach(() => window.localStorage.removeItem(draftsKey));

  it('reads back what a step wrote', () => {
    service.write('targetLangs', [LanguageCode.DE]);
    service.write('levels', {[LanguageCode.DE]: CEFRLevel.C1});

    expect(service.read('targetLangs')).toEqual([LanguageCode.DE]);
    expect(service.read('levels')).toEqual({[LanguageCode.DE]: CEFRLevel.C1});
  });

  it('discards one step without touching the others', () => {
    service.write('targetLangs', [LanguageCode.DE]);
    service.write('interests', [{id: 1, name: 'Travel'}]);

    service.discard('targetLangs');

    expect(service.read('targetLangs')).toBeUndefined();
    expect(service.read('interests')).toEqual([{id: 1, name: 'Travel'}]);
  });

  it('keeps each account\'s draft to itself', () => {
    service.write('targetLangs', [LanguageCode.DE]);

    currentUserInfo = {id: 'user-2'};
    expect(service.read('targetLangs')).toBeUndefined();

    service.write('targetLangs', [LanguageCode.FR]);
    currentUserInfo = {id: 'user-1'};
    expect(service.read('targetLangs')).toEqual([LanguageCode.DE]);
  });

  it('drops everything when onboarding finishes', () => {
    service.write('targetLangs', [LanguageCode.DE]);
    service.write('levels', {[LanguageCode.DE]: CEFRLevel.C1});

    service.discardAll();

    expect(service.read('targetLangs')).toBeUndefined();
    expect(service.read('levels')).toBeUndefined();
  });

  it('does nothing without a signed-in user', () => {
    currentUserInfo = null;

    service.write('targetLangs', [LanguageCode.DE]);

    expect(service.read('targetLangs')).toBeUndefined();
    expect(window.localStorage.getItem(draftsKey)).toBeNull();
  });
});
