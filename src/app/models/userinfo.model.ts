import {LanguageCode} from "./language.enum";

export class UserInfo {
  constructor(
    public id: string,
    public username: string | null,
    public email: string,
    public emailVerified: boolean,
    public uiLang: string | null,
    public profilePicLink: string | null,
    public background: string | null,
    public streak: number | null,
    public targetLangs: LanguageCode[],
    public fluentLangs: LanguageCode[],
    public setupCompleted: boolean,
    public tags: string[] | null,
    public plan: Plan,
    public premium: boolean
  ) {
  }

  static fromJSON(data: any): UserInfo {
    return new UserInfo(
      data.id,
      data.username,
      data.email,
      data.emailVerified,
      data.uiLang,
      data.profilePicLink,
      data.background,
      data.streak,
      data.targetLangs,
      data.fluentLangs,
      data.setupCompleted,
      data.tags,
      Plan.fromJSON(data.plan),
      data.premium
    );
  }

  public isTargetLangPaywalled(): boolean {
    return this.targetLangs.length >= this.plan.getMaxTargetLanguages();
  }
}

export class Plan {
  constructor(
    public name: string,
    public limits: { [key: string]: number },
    public startDate: number,
    public type: PlanType
  ) {
  }

  static fromJSON(data: any): Plan {
    return new Plan(data.name, data.limits, data.startDate, data.type);
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
}
