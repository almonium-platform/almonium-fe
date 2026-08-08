import {LanguageCode} from "./language.enum";
import {Interest} from "../shared/interests/interest.model";
import {
  expectArray,
  expectBoolean,
  expectDate,
  expectEnum,
  expectNullableNumber,
  expectNullableString,
  expectNumber,
  expectRecord,
  expectString,
} from '../shared/runtime-validation';

export class UserInfo {
  constructor(
    public id: string,
    public username: string,
    public email: string,
    public emailVerified: boolean,
    public hidden: boolean,
    public uiLang: string | null,
    public avatarUrl: string | null,
    public background: string | null,
    public streak: number | null,
    public fluentLangs: LanguageCode[],
    public setupStep: SetupStep,
    public tags: string[] | null,
    public subscription: Subscription,
    public premium: boolean,
    public admin: boolean,
    public learners: Learner[],
    public interests: Interest[],
    public uiPreferences: UIPreferences,
  ) {
  }

  update(updates: Partial<UserInfo>): UserInfo {
    return new UserInfo(
      this.id,
      updates.username ?? this.username,
      updates.email ?? this.email,
      updates.emailVerified ?? this.emailVerified,
      updates.hidden ?? this.hidden,
      updates.uiLang ?? this.uiLang,
      updates.avatarUrl ?? this.avatarUrl,
      updates.background ?? this.background,
      updates.streak ?? this.streak,
      updates.fluentLangs ?? this.fluentLangs,
      updates.setupStep ?? this.setupStep,
      updates.tags ?? this.tags,
      updates.subscription ?? this.subscription,
      updates.premium ?? this.premium,
      updates.admin ?? this.admin,
      updates.learners ?? this.learners,
      updates.interests ?? this.interests,
      updates.uiPreferences ?? this.uiPreferences,
    );
  }

  static fromJSON(value: unknown): UserInfo {
    const data = expectRecord(value, 'user');
    return new UserInfo(
      expectString(data['id'], 'user.id'),
      expectString(data['username'], 'user.username'),
      expectString(data['email'], 'user.email'),
      expectBoolean(data['emailVerified'], 'user.emailVerified'),
      expectBoolean(data['hidden'], 'user.hidden'),
      expectNullableString(data['uiLang'], 'user.uiLang'),
      expectNullableString(data['avatarUrl'], 'user.avatarUrl'),
      expectNullableString(data['background'], 'user.background'),
      expectNullableNumber(data['streak'], 'user.streak'),
      parseEnumArray(data['fluentLangs'], Object.values(LanguageCode), 'user.fluentLangs'),
      expectEnum(data['setupStep'], Object.values(SetupStep), 'user.setupStep'),
      parseNullableStringArray(data['tags'], 'user.tags'),
      Subscription.fromJSON(data['subscription']),
      expectBoolean(data['premium'], 'user.premium'),
      expectBoolean(data['admin'], 'user.admin'),
      expectArray(data['learners'], 'user.learners').map((learner, index) =>
        Learner.fromJSON(learner, `user.learners[${index}]`)
      ),
      expectArray(data['interests'], 'user.interests').map((interest, index) =>
        parseInterest(interest, `user.interests[${index}]`)
      ),
      parseUiPreferences(data['uiPreferences']),
    );
  }

  // Dynamic method to get target languages
  get targetLangs(): LanguageCode[] {
    return this.learners
      .map(learner => learner.language);
  }

  // used in target-language-dropdown
  get activeTargetLangs(): LanguageCode[] {
    return this.learners
      .filter(learner => learner.active)
      .map(learner => learner.language);
  }

  public isTargetLangPaywalled(): boolean {
    return this.targetLangs.length >= this.subscription.getMaxTargetLanguages();
  }
}

export interface UserInfoData {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  hidden: boolean;
  uiLang: string | null;
  avatarUrl: string | null;
  background: string | null;
  streak: number | null;
  fluentLangs: LanguageCode[];
  setupStep: SetupStep;
  tags: string[] | null;
  subscription: SubscriptionDto;
  premium: boolean;
  admin: boolean;
  learners: LearnerDto[];
  interests: Interest[];
  uiPreferences: UIPreferences;
}

export interface UserInfoDto extends UserInfoData {
  streamChatToken: string;
}

export interface UIPreferences {
  navbar: {
    discover: boolean;
    review: boolean;
    play: boolean;
    read: boolean;
    write: boolean;
    notifications: boolean;
    social: boolean;
    timer: boolean;
  };
  profileMenu: {
    billing: boolean;
  };
}

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
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
  profileMenu: {
    billing: false,
  },
};

export class Learner {
  constructor(
    public id: string,
    public language: LanguageCode, // Adjust the type if `Language` is an enum or a class
    public selfReportedLevel: CEFRLevel,
    public active: boolean,
  ) {
  }

  static fromJSON(value: unknown, path = 'learner'): Learner {
    const data = expectRecord(value, path);
    return new Learner(
      expectString(data['id'], `${path}.id`),
      expectEnum(data['language'], Object.values(LanguageCode), `${path}.language`),
      expectEnum(data['selfReportedLevel'], Object.values(CEFRLevel), `${path}.selfReportedLevel`),
      expectBoolean(data['active'], `${path}.active`),
    );
  }
}

export interface LearnerDto {
  id: string;
  language: LanguageCode;
  selfReportedLevel: CEFRLevel;
  active: boolean;
}

export enum CEFRLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export class Subscription {
  constructor(
    public name: string,
    public limits: Record<string, number>,
    public type: PlanType,
    public autoRenewal: boolean | null,
    public startDate: Date,
    public endDate: Date | null
  ) {
  }

  static fromJSON(value: unknown): Subscription {
    const data = expectRecord(value, 'user.subscription');
    const rawLimits = expectRecord(data['limits'], 'user.subscription.limits');
    const limits = Object.fromEntries(
      Object.entries(rawLimits).map(([key, limit]) => [
        key,
        expectNumber(limit, `user.subscription.limits.${key}`),
      ])
    );
    const autoRenewal = data['autoRenewal'] === null
      ? null
      : expectBoolean(data['autoRenewal'], 'user.subscription.autoRenewal');

    return new Subscription(
      expectString(data['name'], 'user.subscription.name'),
      limits,
      expectEnum(data['type'], Object.values(PlanType), 'user.subscription.type'),
      autoRenewal,
      expectDate(data['startDate'], 'user.subscription.startDate'),
      data['endDate'] === null || data['endDate'] === undefined
        ? null
        : expectDate(data['endDate'], 'user.subscription.endDate'),
    );
  }

  getLimit(key: string, defaultValue = Infinity): number {
    return this.limits[key] ?? defaultValue;
  }

  getMaxTargetLanguages(): number {
    return this.getLimit(PlanLimitKeys.MAX_TARGET_LANGS);
  }

  getMaxFluentLanguages(): number {
    return this.getLimit(PlanLimitKeys.MAX_FLUENT_LANGS, 3);
  }
}

export interface SubscriptionDto {
  name: string;
  limits: Record<string, number>;
  type: PlanType;
  autoRenewal: boolean | null;
  startDate: string | Date;
  endDate: string | Date | null;
}

export const PlanLimitKeys = {
  MAX_TARGET_LANGS: 'MAX_TARGET_LANGS',
  MAX_FLUENT_LANGS: 'MAX_FLUENT_LANGS',
};

export enum PlanType {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  LIFETIME = 'LIFETIME',
}

export enum SetupStep {
  WELCOME = 'WELCOME',
  PLAN = 'PLAN',
  LANGUAGES = 'LANGUAGES',
  PROFILE = 'PROFILE',
  INTERESTS = 'INTERESTS',
  COMPLETED = 'COMPLETED',
}

// Define an order map
export const SetupStepOrder: Record<SetupStep, number> = {
  [SetupStep.WELCOME]: 0,
  [SetupStep.PLAN]: 1,
  [SetupStep.LANGUAGES]: 2,
  [SetupStep.PROFILE]: 3,
  [SetupStep.INTERESTS]: 4,
  [SetupStep.COMPLETED]: 5,
};

export function isStepAfter(currentStep: SetupStep, referenceStep: SetupStep): boolean {
  return SetupStepOrder[currentStep] > SetupStepOrder[referenceStep];
}

export function getNextStep(currentStep: SetupStep): SetupStep {
  const currentIndex = SetupStepOrder[currentStep];
  const nextIndex = currentIndex + 1;

  const nextStep = Object.keys(SetupStepOrder).find(
    key => SetupStepOrder[key as SetupStep] === nextIndex
  ) as SetupStep | undefined;

  return nextStep ?? SetupStep.COMPLETED;
}

export function parseUserInfoDto(value: unknown): {userInfo: UserInfo; streamChatToken: string} {
  const data = expectRecord(value, 'user');
  return {
    userInfo: UserInfo.fromJSON(data),
    streamChatToken: expectString(data['streamChatToken'], 'user.streamChatToken'),
  };
}

function parseNullableStringArray(value: unknown, path: string): string[] | null {
  if (value === null || value === undefined) return null;
  return expectArray(value, path).map((item, index) => expectString(item, `${path}[${index}]`));
}

function parseEnumArray<T extends string>(value: unknown, values: readonly T[], path: string): T[] {
  return expectArray(value, path).map((item, index) => expectEnum(item, values, `${path}[${index}]`));
}

function parseInterest(value: unknown, path: string): Interest {
  const data = expectRecord(value, path);
  return {
    id: expectNumber(data['id'], `${path}.id`),
    name: expectString(data['name'], `${path}.name`),
  };
}

function parseUiPreferences(value: unknown): UIPreferences {
  if (value === null || value === undefined) {
    return structuredClone(DEFAULT_UI_PREFERENCES);
  }
  const preferences = expectRecord(value, 'user.uiPreferences');
  const navbar = preferences['navbar'] === undefined
    ? {}
    : expectRecord(preferences['navbar'], 'user.uiPreferences.navbar');
  const profileMenu = preferences['profileMenu'] === undefined
    ? {}
    : expectRecord(preferences['profileMenu'], 'user.uiPreferences.profileMenu');

  return {
    navbar: parseBooleanPreferences(DEFAULT_UI_PREFERENCES.navbar, navbar, 'user.uiPreferences.navbar'),
    profileMenu: parseBooleanPreferences(
      DEFAULT_UI_PREFERENCES.profileMenu,
      profileMenu,
      'user.uiPreferences.profileMenu',
    ),
  };
}

function parseBooleanPreferences<T extends Record<string, boolean>>(
  defaults: T,
  value: Record<string, unknown>,
  path: string,
): T {
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      value[key] === undefined ? fallback : expectBoolean(value[key], `${path}.${key}`),
    ])
  ) as T;
}
