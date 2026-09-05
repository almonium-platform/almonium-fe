import {
  freeTierFeatures,
  parseFoundingMemberStatus,
  periodLabel,
  PlanOffer,
} from './plan-offer';
import {PlanDto} from './plan.model';
import {ApiContractError} from '../shared/runtime-validation';

const PLANS: PlanDto[] = [
  {id: 1, name: 'Monthly', type: 'MONTHLY', description: '', price: 12, founderPrice: 8},
  {id: 2, name: 'Yearly', type: 'YEARLY', description: '', price: 120, founderPrice: 80},
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

    expect(offer.founderLimitNote).toBe('Only 20 founding memberships available, then $12 a month.');
  });

  it('drops the reverted price from the limit note when no monthly plan arrived', () => {
    const offer = new PlanOffer([], {capacity: 20, claimed: 7});

    expect(offer.founderLimitNote).toBe('Only 20 founding memberships available.');
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
    expect(offer.alternateCadenceLabel('monthly')).toBe('');
    expect(offer.planId('monthly')).toBe('');
  });

  it('spells out the other cadence rather than showing a rival price tag', () => {
    const offer = new PlanOffer(PLANS, {capacity: 20, claimed: 7});

    expect(offer.alternateCadenceLabel('monthly')).toBe('$80 a year on annual billing');
    expect(offer.alternateCadenceLabel('yearly')).toBe('$8 a month on monthly billing');
    expect(offer.alternatePeriod('monthly')).toBe('yearly');
  });

  it('keeps a plan without a founder price at its list price', () => {
    const offer = new PlanOffer(
      [{id: 3, name: 'Monthly', type: 'MONTHLY', description: '', price: 12, founderPrice: null}],
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
  });

  it('counts against the ceiling once the reader has saved something', () => {
    expect(freeTierFeatures(72)).toContain('72 of 100 saved words and phrases');
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

describe('periodLabel', () => {
  it('names the cadence the price is charged at', () => {
    expect(periodLabel('monthly')).toBe('/ month');
    expect(periodLabel('yearly')).toBe('/ year');
  });
});
