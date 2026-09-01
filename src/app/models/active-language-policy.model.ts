import {LanguageCode} from './language.enum';
import {CEFRLevel} from './userinfo.model';
import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectNullableString,
  expectNumber,
  expectRecord,
} from '../shared/runtime-validation';

/** Unlimited is sent as -1, so a plan with no cap needs no special case on the wire. */
export const UNLIMITED_ALLOWANCE = -1;

export interface LanguageChoice {
  language: LanguageCode;
  cefrLevel: CEFRLevel | null;
  wordsKept: number;
  lastReadOn: Date | null;
  active: boolean;
  /** The one the deadline keeps if the sheet is never answered. */
  recommended: boolean;
}

/**
 * What the account may do with its languages. The downgrade sheet and the language switcher read the same answer,
 * so the sheet cannot offer one language and the deadline take another.
 */
export interface ActiveLanguagePolicy {
  allowance: number;
  /** What survives once no plan is paying: the stake the downgrade sheet is asking about. */
  allowanceWithoutPlan: number;
  nextSwitchAllowedAt: Date | null;
  languages: LanguageChoice[];
}

export function parseActiveLanguagePolicy(value: unknown): ActiveLanguagePolicy {
  const data = expectRecord(value, 'active language policy');
  return {
    allowance: expectNumber(data['allowance'], 'active language policy.allowance'),
    allowanceWithoutPlan: expectNumber(data['allowanceWithoutPlan'], 'active language policy.allowanceWithoutPlan'),
    nextSwitchAllowedAt: parseDate(data['nextSwitchAllowedAt'], 'active language policy.nextSwitchAllowedAt'),
    languages: expectArray(data['languages'], 'active language policy.languages').map((item, index) => {
      const choice = expectRecord(item, `active language policy.languages[${index}]`);
      const level = choice['cefrLevel'];
      return {
        language: expectEnum(
          choice['language'],
          Object.values(LanguageCode),
          `active language policy.languages[${index}].language`,
        ),
        cefrLevel: level === null || level === undefined
          ? null
          : expectEnum(level, Object.values(CEFRLevel), `active language policy.languages[${index}].cefrLevel`),
        wordsKept: expectNumber(choice['wordsKept'], `active language policy.languages[${index}].wordsKept`),
        lastReadOn: parseDate(choice['lastReadOn'], `active language policy.languages[${index}].lastReadOn`),
        active: expectBoolean(choice['active'], `active language policy.languages[${index}].active`),
        recommended: expectBoolean(choice['recommended'], `active language policy.languages[${index}].recommended`),
      };
    }),
  };
}

function parseDate(value: unknown, path: string): Date | null {
  const raw = expectNullableString(value, path);
  return raw === null ? null : new Date(raw);
}

/** How many switches are left is not a number the user cares about — only whether one is available now. */
export function switchAvailable(policy: ActiveLanguagePolicy | null): boolean {
  return !policy?.nextSwitchAllowedAt || policy.nextSwitchAllowedAt.getTime() <= Date.now();
}

export function capped(policy: ActiveLanguagePolicy | null): boolean {
  return !!policy && policy.allowance !== UNLIMITED_ALLOWANCE;
}
