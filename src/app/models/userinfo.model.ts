import {LanguageCode} from "./language.enum";

export class UserInfo {
  constructor(
    public id: string,
    public username: string,
    public email: string,
    public emailVerified: boolean,
    public uiLang: string | null,
    public avatarUrl: string | null,
    public background: string | null,
    public streak: number | null,
    public targetLangs: LanguageCode[],
    public fluentLangs: LanguageCode[],
    public setupCompleted: boolean,
    public tags: string[] | null,
    public subscription: Subscription,
    public premium: boolean
    public interests: Interest[],
  ) {
  }

  update(updates: Partial<UserInfo>): UserInfo {
    return new UserInfo(
      this.id,
      updates.username ?? this.username,
      updates.email ?? this.email,
      updates.emailVerified ?? this.emailVerified,
      updates.uiLang ?? this.uiLang,
      updates.avatarUrl ?? this.avatarUrl,
      updates.background ?? this.background,
      updates.streak ?? this.streak,
      updates.targetLangs ?? this.targetLangs,
      updates.fluentLangs ?? this.fluentLangs,
      updates.setupCompleted ?? this.setupCompleted,
      updates.tags ?? this.tags,
      updates.subscription ?? this.subscription,
      updates.premium ?? this.premium
      updates.interests ?? this.interests,
    );
  }

  static fromJSON(data: any): UserInfo {
    return new UserInfo(
      data.id,
      data.username,
      data.email,
      data.emailVerified,
      data.uiLang,
      data.avatarUrl,
      data.background,
      data.streak,
      data.targetLangs,
      data.fluentLangs,
      data.setupCompleted,
      data.tags,
      Subscription.fromJSON(data.subscription),
      data.premium
      data.interests,
    );
  }

  public isTargetLangPaywalled(): boolean {
    return this.targetLangs.length >= this.subscription.getMaxTargetLanguages();
  }
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
