import {LanguageCode} from "./language.enum";
import {Interest} from "../shared/interests/interest.model";
import {
  expectArray,
  expectBoolean,
  expectDate,
  expectEnum,
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
    public fluentLangs: LanguageCode[],
    public setupStep: SetupStep,
    public tags: string[] | null,
    public subscription: Subscription,
    public premium: boolean,
    public admin: boolean,
    public learners: Learner[],
    public interests: Interest[],
    public uiPreferences: UIPreferences,
    public notifications: NotificationPreferences,
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
      updates.avatarUrl === undefined ? this.avatarUrl : updates.avatarUrl,
      updates.background ?? this.background,
      updates.fluentLangs ?? this.fluentLangs,
      updates.setupStep ?? this.setupStep,
      updates.tags ?? this.tags,
      updates.subscription ?? this.subscription,
      updates.premium ?? this.premium,
      updates.admin ?? this.admin,
      updates.learners ?? this.learners,
      updates.interests ?? this.interests,
      updates.uiPreferences ?? this.uiPreferences,
      updates.notifications ?? this.notifications,
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
      parseNotificationPreferences(data['notifications']),
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

  /**
   * The account holds as many languages as it can store, which is the same number on every plan. Nothing is sold
   * here — what a plan moves is how many of them may be active.
   */
  public isAtLanguageCeiling(): boolean {
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
  fluentLangs: LanguageCode[];
  setupStep: SetupStep;
  tags: string[] | null;
  subscription: SubscriptionDto;
  premium: boolean;
  admin: boolean;
  learners: LearnerDto[];
  interests: Interest[];
  uiPreferences: UIPreferences;
  notifications: NotificationPreferences;
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
    public endDate: Date | null,
    /** Whether this member holds a founding place, which is what lets a screen promise the price is locked. */
    public founder = false,
    /**
     * Set only while a cadence change is pending. A downgrade reads as already made in Paddle from the moment it is
     * requested, so this is what tells the difference between "billed monthly" and "billed annually until September".
     */
    public scheduledChange: ScheduledCadenceChange | null = null,
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
      data['founder'] === undefined ? false : expectBoolean(data['founder'], 'user.subscription.founder'),
      parseScheduledCadenceChange(data['scheduledChange']),
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

export interface ScheduledCadenceChange {
  type: PlanType;
  effectiveAt: Date;
}

function parseScheduledCadenceChange(value: unknown): ScheduledCadenceChange | null {
  if (value === null || value === undefined) return null;
  const data = expectRecord(value, 'user.subscription.scheduledChange');
  return {
    type: expectEnum(data['type'], Object.values(PlanType), 'user.subscription.scheduledChange.type'),
    effectiveAt: expectDate(data['effectiveAt'], 'user.subscription.scheduledChange.effectiveAt'),
  };
}

export interface SubscriptionDto {
  name: string;
  limits: Record<string, number>;
  type: PlanType;
  autoRenewal: boolean | null;
  startDate: string | Date;
  endDate: string | Date | null;
  founder?: boolean;
  scheduledChange?: {type: PlanType; effectiveAt: string | Date} | null;
}

export const PlanLimitKeys = {
  // The storage ceiling: how many languages may exist on the account. The same on every plan and
  // never shrinking, so it is not what a paid tier sells.
  MAX_TARGET_LANGS: 'MAX_TARGET_LANGS',
  // How many of those may be active at once. This is the plan entitlement, and the one the
  // pricing card quotes.
  MAX_ACTIVE_LANGS: 'MAX_ACTIVE_LANGS',
  MAX_FLUENT_LANGS: 'MAX_FLUENT_LANGS',
  MAX_BOOK_IMPORTS_PER_MONTH: 'MAX_BOOK_IMPORTS_PER_MONTH',
};

export enum PlanType {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  LIFETIME = 'LIFETIME',
}

export enum SetupStep {
  WELCOME = 'WELCOME',
  LANGUAGES = 'LANGUAGES',
  LEVEL = 'LEVEL',
  INTERESTS = 'INTERESTS',
  PROFILE = 'PROFILE',
  GREETING = 'GREETING',
  COMPLETED = 'COMPLETED',
}

// Define an order map
export const SetupStepOrder: Record<SetupStep, number> = {
  [SetupStep.WELCOME]: 0,
  [SetupStep.LANGUAGES]: 1,
  [SetupStep.LEVEL]: 2,
  [SetupStep.INTERESTS]: 3,
  [SetupStep.PROFILE]: 4,
  [SetupStep.GREETING]: 5,
  [SetupStep.COMPLETED]: 6,
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

/** Which emails the account receives. The in-app bell and push are not governed here. */
export interface NotificationPreferences {
  /** Connection requests received and requests accepted. */
  socialEmails: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  socialEmails: true,
};

function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (value === null || value === undefined) {
    return {...DEFAULT_NOTIFICATION_PREFERENCES};
  }
  const preferences = expectRecord(value, 'user.notifications');
  return {
    socialEmails: preferences['socialEmails'] === undefined
      ? DEFAULT_NOTIFICATION_PREFERENCES.socialEmails
      : expectBoolean(preferences['socialEmails'], 'user.notifications.socialEmails'),
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
