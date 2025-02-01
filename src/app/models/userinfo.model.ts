import {LanguageCode} from "./language.enum";
import {Interest} from "../shared/interests/interest.model";

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
      updates.learners ?? this.learners,
      updates.interests ?? this.interests,
      updates.uiPreferences ?? this.uiPreferences // Update new field
    );
  }

  static fromJSON(data: any): UserInfo {
    return new UserInfo(
      data.id,
      data.username,
      data.email,
      data.emailVerified,
      data.hidden,
      data.uiLang,
      data.avatarUrl,
      data.background,
      data.streak,
      data.fluentLangs,
      data.setupStep,
      data.tags,
      Subscription.fromJSON(data.subscription),
      data.premium,
      data.learners.map((learner: any) => Learner.fromJSON(learner)),
      data.interests,
      data.uiPreferences
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
    public id: number,
    public language: LanguageCode, // Adjust the type if `Language` is an enum or a class
    public selfReportedLevel: CEFRLevel,
    public active: boolean,
  ) {
  }

  static fromJSON(data: any): Learner {
    return new Learner(
      data.id,
      data.language,
      data.selfReportedLevel,
      data.active,
    );
  }
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
    public limits: { [key: string]: number },
    public type: PlanType,
    public autoRenewal: boolean | null,
    public startDate: Date,
    public endDate: Date
  ) {
  }

  static fromJSON(data: any): Subscription {
    return new Subscription(data.name, data.limits, data.type, data.autoRenewal, new Date(data.startDate), new Date(data.endDate));
  }

  getLimit(key: string, defaultValue: number = Infinity): number {
    return this.limits[key] ?? defaultValue;
  }

  getMaxTargetLanguages(): number {
    return this.getLimit(PlanLimitKeys.MAX_TARGET_LANGS);
  }
}

export const PlanLimitKeys = {
  MAX_TARGET_LANGS: 'MAX_TARGET_LANGS',
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
