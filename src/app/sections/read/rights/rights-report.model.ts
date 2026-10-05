import {expectRecord, expectString} from '../../../shared/runtime-validation';

/** Who is writing: a rights holder's report is the one that can end in a takedown. */
export const REPORTER_ROLES = ['RIGHTS_HOLDER', 'READER', 'OTHER'] as const;
export type ReporterRole = typeof REPORTER_ROLES[number];

export const REPORT_MESSAGE_MIN = 10;
export const REPORT_MESSAGE_MAX = 4000;
export const REPORT_NAME_MAX = 200;

/** A report against a book's rights. A member's account address is used; a guest must leave one. */
export interface RightsReportRequest {
  role: ReporterRole;
  name?: string;
  email?: string;
  /** ISO alpha-2 of the country the report is about, or '' for everywhere. */
  country: string;
  message: string;
}

export interface RightsReportReceipt {
  id: string;
  /** Where to write with more: copyright@almonium.com. */
  contact: string;
}

export function parseRightsReportReceipt(value: unknown): RightsReportReceipt {
  const data = expectRecord(value, 'receipt');
  return {
    id: expectString(data['id'], 'receipt.id'),
    contact: expectString(data['contact'], 'receipt.contact'),
  };
}

/** What the form holds, as the line under a greyed Send reads it. */
export interface RightsReportDraft {
  role: ReporterRole | null;
  email: string;
  message: string;
  guest: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The one thing still missing before Send, or null when the report can go. */
export function reportMissing(draft: RightsReportDraft): string | null {
  if (draft.role === null) return $localize`Say who you are.`;
  const message = draft.message.trim();
  if (message.length < REPORT_MESSAGE_MIN) {
    const left = REPORT_MESSAGE_MIN - message.length;
    return $localize`Describe the problem: ${left}:left: more characters at least.`;
  }
  if (message.length > REPORT_MESSAGE_MAX) {
    return $localize`Shorten the message to ${REPORT_MESSAGE_MAX}:max: characters.`;
  }
  if (draft.guest) {
    const email = draft.email.trim();
    if (email.length === 0) return $localize`Leave your email so we can answer.`;
    if (!EMAIL_PATTERN.test(email)) return $localize`Check the email address.`;
  }
  return null;
}

/** Every ISO 3166-1 alpha-2 country, for the "which country" select. */
export const COUNTRY_CODES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '
  + 'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
  + 'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO '
  + 'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR '
  + 'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO '
  + 'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV '
  + 'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

export interface CountryOption {
  code: string;
  name: string;
}

/** The countries named in the interface's language and sorted by that name; the code stands in where it has none. */
export function countryOptions(locale: string, codes: readonly string[] = COUNTRY_CODES): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale, 'en'], {type: 'region'});
  } catch {
    names = null;
  }
  return codes
    .map(code => ({code, name: names?.of(code) ?? code}))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
