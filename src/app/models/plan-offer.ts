import {PlanDto} from './plan.model';
import {PlanLimitKeys} from './userinfo.model';
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
  // Both cadences grant the same entitlement, so one map answers for the tier.
  private readonly limits: Record<string, number> = {};

  constructor(plans: PlanDto[], private readonly foundingStatus: FoundingMemberStatus | null) {
    for (const period of Object.keys(PLAN_TYPE) as BillingPeriod[]) {
      const plan = plans.find(candidate => candidate.type === PLAN_TYPE[period]);
      if (!plan) {
        continue;
      }
      this.premiumPrice[period] = plan.price;
      this.founderPrice[period] = plan.founderPrice;
      this.planIds[period] = String(plan.id);
      Object.assign(this.limits, plan.limits);
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
    return this.founderOfferAvailable ? 'Claim your place' : 'Go Premium';
  }

  /**
   * What the paid tier grants, from the server that enforces it. The fallback is the figure the
   * card was drawn with: the plans request has to land before any price renders anyway, so this
   * only covers that window and the error path — the same bargain Subscription.getLimit strikes.
   */
  limitFor(key: string, fallback: number): number {
    return this.limits[key] ?? fallback;
  }

  // What a place is worth: how many there are, and the price the offer reverts to without one.
  get founderLimitNote(): string {
    const standard = this.premiumPrice.monthly;
    return standard === null
      ? `Only ${this.capacity} founding memberships available.`
      : `Only ${this.capacity} founding memberships available, then $${standard} a month.`;
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

  // The figure that no longer applies, struck through in muted ink at body size. While places
  // remain it is the standard price, so the founder rate has something to bite on; once the last
  // one is gone it is the founder rate itself, proof the offer was real. Either way it is never a
  // second price the reader could try to pick, and there is nothing to strike when no offer ran.
  struckPriceFor(period: BillingPeriod): number | null {
    const applicable = this.priceFor(period);
    let struck: number | null = null;
    if (this.founderOfferAvailable) {
      struck = this.premiumPrice[period];
    } else if (this.founderSoldOut) {
      struck = this.founderPrice[period];
    }
    return struck === null || struck === applicable ? null : struck;
  }

  alternatePeriod(period: BillingPeriod): BillingPeriod {
    return period === 'monthly' ? 'yearly' : 'monthly';
  }

  // The selected term owns the price display — one figure and its struck standard price. The other
  // term is a single line of cross-sell underneath, with no second anchor to weigh against it.
  alternateCadenceLabel(period: BillingPeriod): string {
    const alternate = this.alternatePeriod(period);
    const price = this.priceFor(alternate);
    if (price === null) {
      return '';
    }
    return alternate === 'yearly'
      ? `or $${price} a year — 2 months free`
      : `or $${price} a month`;
  }
}

export function periodLabel(period: BillingPeriod): string {
  return period === 'monthly' ? '/ month' : '/ year';
}

// The free tier's saved-item ceiling. The backend has no plan-limit key for it, so the number
// lives here and prints in both the static line and the signed-in usage line.
export const FREE_SAVED_ITEMS_LIMIT = 100;

/**
 * What each tier buys, in the words the pricing card uses. The paywall and the landing page draw
 * the same two cards, so the entries live beside the prices rather than once in each component,
 * where they drifted into two different lists of two different lengths.
 */
export function freeTierFeatures(savedItems: number | null): string[] {
  return [
    'Every book in the library, unlimited reading',
    'Unlimited word lookups',
    savedItemsFeature(savedItems),
    'One target language, unlimited review',
    'Confusion feedback',
  ];
}

// The numbers the card was drawn with, and what it prints until the offer lands.
const PAID_ACTIVE_LANGS_FALLBACK = 5;
const PAID_BOOK_IMPORTS_FALLBACK = 3;

export function paidTierFeatures(offer: PlanOffer | null): string[] {
  const languages = offer?.limitFor(PlanLimitKeys.MAX_ACTIVE_LANGS, PAID_ACTIVE_LANGS_FALLBACK)
    ?? PAID_ACTIVE_LANGS_FALLBACK;
  const imports = offer?.limitFor(PlanLimitKeys.MAX_BOOK_IMPORTS_PER_MONTH, PAID_BOOK_IMPORTS_FALLBACK)
    ?? PAID_BOOK_IMPORTS_FALLBACK;
  return [
    `Unlimited saved words, and ${languages} languages at once`,
    'Every book at your level — B1, B2 and C1 editions',
    'Chat with Almo, who uses the words you’re learning',
    'Narrated audiobooks',
    `Import your own books, ${imports} a month`,
    'Share word packs with friends',
  ];
}

// The saved entry counts only for a reader who is signed in and has saved something. A new
// account reads the plain ceiling: "0 of 100" is a scold, not information.
function savedItemsFeature(savedItems: number | null): string {
  return savedItems
    ? `${savedItems} of ${FREE_SAVED_ITEMS_LIMIT} saved words and phrases`
    : `${FREE_SAVED_ITEMS_LIMIT} saved words and phrases`;
}
