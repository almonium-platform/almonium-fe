import {
  expectArray,
  expectEnum,
  expectNullableNumber,
  expectNumber,
  expectRecord,
  expectString,
} from '../shared/runtime-validation';

export interface PlanDto {
  id: number;
  name: string;
  type: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
  description: string;
  price: number;
  founderPrice: number | null;
  // What the plan grants, keyed by PlanLimitKeys. The pricing card states these before anyone has
  // bought the plan, so they travel with the public offer rather than with a subscription.
  limits: Record<string, number>;
}

export function parsePlans(value: unknown): PlanDto[] {
  return expectArray(value, 'plans').map((item, index) => {
    const plan = expectRecord(item, `plans[${index}]`);
    return {
      id: expectNumber(plan['id'], `plans[${index}].id`),
      name: expectString(plan['name'], `plans[${index}].name`),
      type: expectEnum(plan['type'], ['MONTHLY', 'YEARLY', 'LIFETIME'], `plans[${index}].type`),
      description: expectString(plan['description'], `plans[${index}].description`),
      price: expectNumber(plan['price'], `plans[${index}].price`),
      founderPrice: expectNullableNumber(plan['founderPrice'], `plans[${index}].founderPrice`),
      limits: parsePlanLimits(plan['limits'], `plans[${index}].limits`),
    };
  });
}

// An older server sends no limits at all; the card falls back to its own numbers rather than
// refusing to render a price over a missing marketing figure.
function parsePlanLimits(value: unknown, path: string): Record<string, number> {
  if (value === null || value === undefined) {
    return {};
  }
  const limits = expectRecord(value, path);
  return Object.fromEntries(
    Object.entries(limits).map(([key, limit]) => [key, expectNumber(limit, `${path}.${key}`)]),
  );
}

export interface SessionUrlResponse {
  sessionUrl: string;
}

export function parseSessionUrlResponse(value: unknown): SessionUrlResponse {
  const response = expectRecord(value, 'subscription session');
  return {sessionUrl: expectString(response['sessionUrl'], 'subscription session.sessionUrl')};
}
