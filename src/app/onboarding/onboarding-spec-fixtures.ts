import {LanguageCode} from '../models/language.enum';
import {CEFRLevel, PlanType, SetupStep, UserInfo} from '../models/userinfo.model';
import {Interest} from '../shared/interests/interest.model';

export const SPEC_USER_ID = '01990a4f-59d4-7000-8000-000000000001';
export const ONBOARDING_DRAFTS_KEY = 'onboarding_drafts';

/** A user one step into onboarding, learning German, for step component specs. */
export function onboardingUserInfo(setupStep: SetupStep, interests: Interest[] = []): UserInfo {
  return UserInfo.fromJSON({
    id: SPEC_USER_ID,
    username: 'reader',
    email: 'reader@example.com',
    emailVerified: true,
    hidden: false,
    uiLang: null,
    avatarUrl: null,
    background: null,
    fluentLangs: [LanguageCode.EN],
    setupStep,
    tags: [],
    subscription: {
      name: 'FREE',
      limits: {MAX_TARGET_LANGS: 1, MAX_FLUENT_LANGS: 1},
      type: PlanType.LIFETIME,
      autoRenewal: false,
      startDate: '2026-03-18T00:00:00Z',
      endDate: null,
    },
    premium: false,
    admin: false,
    learners: [{
      id: '01990a4f-59d4-7000-8000-000000000002',
      language: LanguageCode.DE,
      selfReportedLevel: CEFRLevel.B1,
      active: true,
    }],
    interests,
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

export function seedDraft(draft: Record<string, unknown>): void {
  window.localStorage.setItem(ONBOARDING_DRAFTS_KEY, JSON.stringify({[SPEC_USER_ID]: draft}));
}

export function storedDraft(): Record<string, unknown> | undefined {
  const drafts = window.localStorage.getItem(ONBOARDING_DRAFTS_KEY);
  return drafts ? (JSON.parse(drafts) as Record<string, Record<string, unknown>>)[SPEC_USER_ID] : undefined;
}
