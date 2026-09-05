import {PlanDto} from './plan.model';
import {expectNumber, expectRecord} from '../shared/runtime-validation';

export type BillingPeriod = 'monthly' | 'yearly';

export interface FoundingMemberStatus {
  capacity: number;
  claimed: number;
}

export function parseFoundingMemberStatus(value: unknown): FoundingMemberStatus {
  const status = expectRecord(value, 'founding-member status');
  return {
    capacity: expectNumber(status['capacity'], 'founding-member status.capacity'),
    claimed: expectNumber(status['claimed'], 'founding-member status.claimed'),
  };
}

const PLAN_TYPE: Record<BillingPeriod, PlanDto['type']> = {monthly: 'MONTHLY', yearly: 'YEARLY'};

/**
 * The paid offer as a visitor sees it. The paywall and the landing page both price the same thing,
 * and the rule — the founder price while places remain, the list price once they are gone — lives
 * here so the two can never quote different numbers. It is also why neither of them holds a price
 * of its own: a hardcoded figure is how a page ends up advertising a plan that no longer exists.
 */
export class PlanOffer {
  private readonly premiumPrice: Record<BillingPeriod, number | null> = {monthly: null, yearly: null};
  private readonly founderPrice: Record<BillingPeriod, number | null> = {monthly: null, yearly: null};
  private readonly planIds: Record<BillingPeriod, string> = {monthly: '', yearly: ''};

  constructor(plans: PlanDto[], private readonly foundingStatus: FoundingMemberStatus | null) {
    for (const period of Object.keys(PLAN_TYPE) as BillingPeriod[]) {
      const plan = plans.find(candidate => candidate.type === PLAN_TYPE[period]);
      if (!plan) {
        continue;
      }
      this.premiumPrice[period] = plan.price;
      this.founderPrice[period] = plan.founderPrice;
      this.planIds[period] = String(plan.id);
    }
  }

  get founderOfferAvailable(): boolean {
    return !!this.foundingStatus && this.foundingStatus.claimed < this.foundingStatus.capacity;
  }

  get founderSoldOut(): boolean {
    return !!this.foundingStatus && this.foundingStatus.claimed >= this.foundingStatus.capacity;
  }

  get capacity(): number {
    return this.foundingStatus?.capacity ?? 0;
  }

  get claimed(): number {
    return this.foundingStatus?.claimed ?? 0;
  }

  get tierLabel(): string {
    return this.founderOfferAvailable ? 'Founding member' : 'Premium';
  }

  get ctaLabel(): string {
    return this.founderOfferAvailable ? 'Take a place' : 'Go Premium';
  }

  planId(period: BillingPeriod): string {
    return this.planIds[period];
  }

  // The one price that applies to this visitor for this cadence — never a band, never a range.
  priceFor(period: BillingPeriod): number | null {
    const founderValue = this.founderPrice[period];
    if (this.founderOfferAvailable && founderValue !== null) {
      return founderValue;
    }
    return this.premiumPrice[period];
  }

  // Once the last place is gone the founder price is struck through: proof the offer was real,
  // never a second price the reader could try to pick.
  struckPriceFor(period: BillingPeriod): number | null {
    if (!this.founderSoldOut) {
      return null;
    }
    const founderValue = this.founderPrice[period];
    return founderValue === this.priceFor(period) ? null : founderValue;
  }

  alternatePeriod(period: BillingPeriod): BillingPeriod {
    return period === 'monthly' ? 'yearly' : 'monthly';
  }

  // What the other cadence costs, spelled out rather than shown as a rival price tag.
  alternateCadenceLabel(period: BillingPeriod): string {
    const alternate = this.alternatePeriod(period);
    const price = this.priceFor(alternate);
    if (price === null) {
      return '';
    }
    return period === 'monthly'
      ? `$${price} a year on annual billing`
      : `$${price} a month on monthly billing`;
  }
}

export function periodLabel(period: BillingPeriod): string {
  return period === 'monthly' ? '/ month' : '/ year';
}
