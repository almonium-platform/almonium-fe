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
    };
  });
}

export interface SessionUrlResponse {
  sessionUrl: string;
}

export function parseSessionUrlResponse(value: unknown): SessionUrlResponse {
  const response = expectRecord(value, 'subscription session');
  return {sessionUrl: expectString(response['sessionUrl'], 'subscription session.sessionUrl')};
}
