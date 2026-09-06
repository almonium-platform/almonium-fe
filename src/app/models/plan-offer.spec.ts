import {
  effectiveMonthlyRate,
  freeTierFeatures,
  paidTierFeatures,
  parseFoundingMemberStatus,
  periodLabel,
  PlanOffer,
} from './plan-offer';
import {PlanDto} from './plan.model';
import {ApiContractError} from '../shared/runtime-validation';

const LIMITS = {MAX_ACTIVE_LANGS: 5, MAX_BOOK_IMPORTS_PER_MONTH: 3};

const PLANS: PlanDto[] = [
  {id: 1, name: 'Monthly', type: 'MONTHLY', description: '', price: 12, founderPrice: 8, limits: LIMITS},
  {id: 2, name: 'Yearly', type: 'YEARLY', description: '', price: 120, founderPrice: 80, limits: LIMITS},
];

describe('PlanOffer', () => {
  it('quotes the founder price while places remain', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});

    expect(offer.founderOfferAvailable).toBeTrue();
    expect(offer.founderSoldOut).toBeFalse();
    expect(offer.priceFor('monthly')).toBe(8);
    expect(offer.priceFor('yearly')).toBe(80);
    expect(offer.tierLabel).toBe('Founding member');
    expect(offer.ctaLabel).toBe('Claim your place');
  });

  it('strikes the standard price while places remain, so the founder rate has something to bite on', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});

    expect(offer.struckPriceFor('monthly')).toBe(12);
    expect(offer.struckPriceFor('yearly')).toBe(120);
  });

  it('names the price a place saves the reader from, so the limit reads as an offer', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});

    expect(offer.founderLimitNote).toBe('20 founding memberships, then $12 a month.');
  });

  it('drops the reverted price from the limit note when no monthly plan arrived', () => {
    const offer = new PlanOffer([], {capacity: 20, claimed: 7});

    expect(offer.founderLimitNote).toBe('20 founding memberships.');
  });

  it('falls back to the list price once the last place is gone, and strikes the founder price', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 20});

    expect(offer.founderOfferAvailable).toBeFalse();
    expect(offer.founderSoldOut).toBeTrue();
    expect(offer.priceFor('monthly')).toBe(12);
    expect(offer.struckPriceFor('monthly')).toBe(8);
    expect(offer.tierLabel).toBe('Premium');
    expect(offer.ctaLabel).toBe('Go Premium');
  });

  it('strikes nothing when no founding-member offer ever ran', () => {
    const offer = new PlanOffer(PLANS, null);

    expect(offer.struckPriceFor('monthly')).toBeNull();
    expect(offer.struckPriceFor('yearly')).toBeNull();
  });

  it('treats an unreachable founding-member status as no offer at all', () => {
    const offer = new PlanOffer(PLANS, null);

    expect(offer.founderOfferAvailable).toBeFalse();
    expect(offer.founderSoldOut).toBeFalse();
    expect(offer.priceFor('monthly')).toBe(12);
    expect(offer.capacity).toBe(0);
  });

  it('reports no price when the plans never arrived', () => {
    const offer = new PlanOffer([], {capacity: 20, claimed: 7});

    expect(offer.priceFor('monthly')).toBeNull();
    expect(offer.cadenceNotes('monthly')).toEqual([]);
    expect(offer.cadenceNotes('yearly')).toEqual([]);
    expect(offer.annualPromptLine(false)).toBeNull();
    expect(offer.planId('monthly')).toBe('');
  });

  it('cross-sells annual under a monthly price as an amount and its monthly rate, never a month count', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});

    expect(offer.cadenceNotes('monthly')).toEqual(['or $80 a year — that’s $6.67 a month']);
    expect(offer.alternatePeriod('monthly')).toBe('yearly');
  });

  it('shows the annual saving as arithmetic: the monthly rate, then the same year billed monthly', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});

    expect(offer.cadenceNotes('yearly')).toEqual([
      'That’s $6.67 a month',
      'or $96 a year, billed monthly at $8',
    ]);
  });

  it('quotes the list figures once the founder offer is gone, with whole dollars where they divide', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 20});

    expect(offer.cadenceNotes('monthly')).toEqual(['or $120 a year — that’s $10 a month']);
    expect(offer.cadenceNotes('yearly')).toEqual([
      'That’s $10 a month',
      'or $144 a year, billed monthly at $12',
    ]);
  });

  it('never says "months free" or a percentage anywhere in the notes', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});
    const everything = [...offer.cadenceNotes('monthly'), ...offer.cadenceNotes('yearly'), offer.annualPromptLine(true)].join(' ');

    expect(everything).not.toMatch(/months? free|%|save/i);
  });

  it('writes the annual prompt in the member’s own tier, whatever the offer’s state today', () => {
    const soldOut = new PlanOffer(PLANS, {capacity: 20, claimed: 20});

    expect(soldOut.annualPromptLine(true)).toBe('$80 a year comes to $6.67 a month, instead of $8.');
    expect(soldOut.annualPromptLine(false)).toBe('$120 a year comes to $10 a month, instead of $12.');
  });

  it('keeps a plan without a founder price at its list price', () => {
    const offer = new PlanOffer(
      [{id: 3, name: 'Monthly', type: 'MONTHLY', description: '', price: 12, founderPrice: null, limits: {}}],
      {capacity: 20, claimed: 7},
    );

    expect(offer.priceFor('monthly')).toBe(12);
    expect(offer.struckPriceFor('monthly')).toBeNull();
  });

  it('checks out against the plan for the chosen cadence', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});

    expect(offer.planId('monthly')).toBe('1');
    expect(offer.planId('yearly')).toBe('2');
  });
});

describe('freeTierFeatures', () => {
  it('prints the plain ceiling until something is saved', () => {
    expect(freeTierFeatures(null)).toContain('100 saved words and phrases');
    expect(freeTierFeatures(0)).toContain('100 saved words and phrases');
    expect(freeTierFeatures(null)).toContain('One target language, unlimited review');
  });

  it('counts against the ceiling once the reader has saved something', () => {
    expect(freeTierFeatures(72)).toContain('72 of 100 saved words and phrases');
  });
});

describe('paidTierFeatures', () => {
  it('quotes the allowances the server enforces', () => {
    const offer = new PlanOffer(
      [{
        id: 1, name: 'Monthly', type: 'MONTHLY', description: '', price: 12, founderPrice: 8,
        limits: {MAX_ACTIVE_LANGS: 8, MAX_BOOK_IMPORTS_PER_MONTH: 10},
      }],
      {capacity: 20, claimed: 7},
    );

    expect(paidTierFeatures(offer)).toContain('Unlimited saved words, and 8 languages at once');
    expect(paidTierFeatures(offer)).toContain('Import your own books, 10 a month');
  });

  it('prints the drawn numbers until the plans land, rather than an empty promise', () => {
    expect(paidTierFeatures(null)).toContain('Unlimited saved words, and 3 languages at once');
    expect(paidTierFeatures(null)).toContain('Import your own books, 3 a month');
  });

  it('falls back per key when the server sends limits it does not model yet', () => {
    const offer = new PlanOffer(
      [{
        id: 1, name: 'Monthly', type: 'MONTHLY', description: '', price: 12, founderPrice: 8,
        limits: {MAX_ACTIVE_LANGS: 8},
      }],
      null,
    );

    expect(paidTierFeatures(offer)).toContain('Unlimited saved words, and 8 languages at once');
    expect(paidTierFeatures(offer)).toContain('Import your own books, 3 a month');
  });
});

describe('parseFoundingMemberStatus', () => {
  it('reads capacity and claimed', () => {
    expect(parseFoundingMemberStatus({capacity: 20, claimed: 7})).toEqual({capacity: 20, claimed: 7});
  });

  it('rejects a payload that does not carry the counts', () => {
    expect(() => parseFoundingMemberStatus({capacity: 20})).toThrowError(ApiContractError);
  });
});

describe('effectiveMonthlyRate', () => {
  it('prints cents only when the year does not divide into whole dollars', () => {
    expect(effectiveMonthlyRate(120)).toBe('$10');
    expect(effectiveMonthlyRate(80)).toBe('$6.67');
    expect(effectiveMonthlyRate(90)).toBe('$7.50');
  });
});

describe('periodLabel', () => {
  it('names the cadence the price is charged at', () => {
    expect(periodLabel('monthly')).toBe('/ month');
    expect(periodLabel('yearly')).toBe('/ year');
  });
});
