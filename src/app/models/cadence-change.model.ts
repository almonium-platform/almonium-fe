import {
  expectArray,
  expectBoolean,
  expectDate,
  expectEnum,
  expectNullableNumber,
  expectNumber,
  expectRecord,
  expectString,
} from '../shared/runtime-validation';
import {PlanType} from './userinfo.model';

/**
 * How a member may move between monthly and annual billing.
 *
 * The two directions are not symmetric, so neither are the options. Monthly to annual prorates on the spot. Annual to
 * monthly is scheduled for renewal, because an immediate credit for the unused months lands on a Paddle balance the
 * member cannot see — unless the annual payment is still inside the guarantee, when it can simply be refunded.
 */
export enum CadenceChangeKind {
  PRORATED_NOW = 'PRORATED_NOW',
  SCHEDULED = 'SCHEDULED',
  REFUND_AND_SWITCH = 'REFUND_AND_SWITCH',
}

export interface CadenceChangeOption {
  kind: CadenceChangeKind;
  recommended: boolean;
  dueNowMinorUnits: number;
  /** Proration credit for time already paid for. Null when there is none — a "$0.00" credit row is only noise. */
  creditMinorUnits: number | null;
  refundMinorUnits: number | null;
  effectiveAt: Date;
  nextBilledAt: Date;
}

export interface CadenceChangePreview {
  currentType: PlanType;
  targetType: PlanType;
  targetPriceMinorUnits: number;
  founderPrice: boolean;
  currencyCode: string;
  currentPeriodEndsAt: Date;
  options: CadenceChangeOption[];
}

export function parseCadenceChangePreview(value: unknown): CadenceChangePreview {
  const data = expectRecord(value, 'cadence change');
  return {
    currentType: expectEnum(data['currentType'], Object.values(PlanType), 'cadence change.currentType'),
    targetType: expectEnum(data['targetType'], Object.values(PlanType), 'cadence change.targetType'),
    targetPriceMinorUnits: expectNumber(data['targetPriceMinorUnits'], 'cadence change.targetPriceMinorUnits'),
    founderPrice: expectBoolean(data['founderPrice'], 'cadence change.founderPrice'),
    currencyCode: expectString(data['currencyCode'], 'cadence change.currencyCode'),
    currentPeriodEndsAt: expectDate(data['currentPeriodEndsAt'], 'cadence change.currentPeriodEndsAt'),
    options: expectArray(data['options'], 'cadence change.options').map((option, index) => {
      const record = expectRecord(option, `cadence change.options[${index}]`);
      return {
        kind: expectEnum(record['kind'], Object.values(CadenceChangeKind), `cadence change.options[${index}].kind`),
        recommended: expectBoolean(record['recommended'], `cadence change.options[${index}].recommended`),
        dueNowMinorUnits: expectNumber(
          record['dueNowMinorUnits'],
          `cadence change.options[${index}].dueNowMinorUnits`,
        ),
        creditMinorUnits: expectNullableNumber(
          record['creditMinorUnits'],
          `cadence change.options[${index}].creditMinorUnits`,
        ),
        refundMinorUnits: expectNullableNumber(
          record['refundMinorUnits'],
          `cadence change.options[${index}].refundMinorUnits`,
        ),
        effectiveAt: expectDate(record['effectiveAt'], `cadence change.options[${index}].effectiveAt`),
        nextBilledAt: expectDate(record['nextBilledAt'], `cadence change.options[${index}].nextBilledAt`),
      };
    }),
  };
}

/**
 * Amounts arrive in minor units beside their currency code, because the server is not in a position to know how many
 * decimal places the member's currency has and neither are we. Intl does, so it formats them.
 */
export function formatMinorUnits(minorUnits: number, currencyCode: string): string {
  const formatter = new Intl.NumberFormat(undefined, {style: 'currency', currency: currencyCode});
  const exponent = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minorUnits / 10 ** exponent);
}
