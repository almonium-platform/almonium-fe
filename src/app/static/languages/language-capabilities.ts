import {LanguageCode} from '../../models/language.enum';

/**
 * What Almonium can do in each language, as one table the public `/languages` page renders.
 *
 * This file is the thing to edit as the linguistic core lands: move a cell from `planned` to
 * `ready` when the capability is built and verified, and to `live` when a learner can use it.
 * The pronunciation columns come from listening tests recorded in
 * `almonium-be/docs/TTS_IPA_FINDINGS.md`; do not mark an engine as following IPA on its
 * documentation alone, only after the audio was heard.
 */

/** How far a capability has come for one language. */
export type CapabilityStatus =
  /** A learner can use it in the app today. */
  | 'live'
  /** Built or verified by test, not switched on in the app yet. */
  | 'ready'
  /** Intended, not started. */
  | 'planned'
  /** No way to do it is known yet. */
  | 'none';

/** The speech engine a language's voice comes from. Named because the reader is entitled to know. */
export type VoiceEngine =
  | 'Google Chirp 3 HD'
  | 'Google WaveNet'
  | 'Google Neural2'
  | 'Google Standard'
  | 'Azure Neural';

/**
 * Whether the voice says the pronunciation written in IPA, rather than guessing from the spelling.
 * `stress` means it also puts the stress on the syllable the IPA marks.
 */
export type IpaMatch =
  | 'stress'
  /** The sounds follow the IPA; the stress mark is not obeyed or was not judged. */
  | 'sounds'
  /** The language has no word stress to mark, so matching sounds is the whole job. */
  | 'no-stress'
  /** A voice exists and reads the spelling; no engine tried follows IPA for this language. */
  | 'not-followed'
  /** Nobody has tested it. */
  | 'untested';

export interface LanguageCapability {
  code: LanguageCode;
  /** Native speakers in millions. Approximate; `speakersFromEthnologue` says where it came from. */
  nativeSpeakersMillions: number;
  /** True when the figure is Ethnologue's 2026 count; false when it is our own rough estimate. */
  speakersFromEthnologue: boolean;
  /** The voice picked for word audio, where one exists. */
  voice: {status: CapabilityStatus; engine?: VoiceEngine};
  ipaMatch: IpaMatch;
  /** Recognising an inflected form as its dictionary word, as the book analysis does. */
  wordForms: CapabilityStatus;
  /** How common a word is, with its source. */
  frequency: CapabilityStatus;
  /** A stored dictionary entry with senses and a level per sense. */
  entries: CapabilityStatus;
}

type Speakers = readonly [millions: number, ethnologue?: true];

/** Native speakers per language, in millions. Marked figures are Ethnologue 2026; the rest are estimates. */
const SPEAKERS: Record<LanguageCode, Speakers> = {
  AF: [7.2], SQ: [6], AM: [35], AR: [370], HY: [5.3], AS: [15], AY: [1.7], AZ: [24], BM: [4.2], EU: [0.75],
  BE: [2.5], BN: [232, true], BHO: [53, true], BS: [2.5], BG: [7], CA: [4.1], CEB: [21], ZH: [988, true], CO: [0.15],
  HR: [5.1], CS: [10.6], DA: [5.6], DV: [0.34], DOI: [2.6], NL: [25], EN: [372, true], EO: [0.002], ET: [1.1],
  EE: [5], FIL: [29], FI: [5], FR: [76, true], FY: [0.47], GL: [2.4], KA: [3.7], DE: [76, true], EL: [13], GN: [6.5],
  GU: [58, true], HT: [13], HA: [58, true], HAW: [0.002], HE: [5], HI: [347, true], HMN: [4], HU: [13], IS: [0.33],
  IG: [31], ILO: [8], ID: [78, true], GA: [0.17], IT: [60, true], JA: [124, true], JV: [69, true], KN: [44], KK: [13],
  KM: [17], RW: [13], GOM: [2.3], KO: [82, true], KRI: [0.8], KU: [16], CKB: [8], KY: [5], LO: [4], LA: [0], LV: [1.5],
  LN: [20], LT: [2.8], LG: [5.6], LB: [0.3], MK: [1.6], MAI: [34], MG: [25], MS: [19], ML: [37], MT: [0.5], MI: [0.05],
  MR: [83, true], LUS: [0.8], MN: [6], MY: [33], NE: [19], NO: [5.3], NY: [14], OR: [35], OM: [37], PS: [44],
  FA: [65, true], PL: [40], PT: [252, true], PA: [120], QU: [7], RO: [24], RU: [133, true], SM: [0.5], SA: [0.02],
  GD: [0.06], NSO: [4.6], SR: [6.5], ST: [5.6], SN: [8], SD: [32], SI: [16], SK: [5.2], SL: [2.1], SO: [22],
  ES: [487, true], SU: [32], SW: [5], SV: [10], TL: [29], TG: [8], TA: [79, true], TT: [5], TE: [83, true], TH: [21],
  TI: [9], TS: [4], TR: [86, true], TK: [7], AK: [9], UK: [33], UR: [78, true], UG: [11], UZ: [34], VI: [86, true],
  CY: [0.6], XH: [8], YI: [0.6], YO: [45], ZU: [13],
  // Added with the wider language list; rough figures from Wikidata, none of them Ethnologue's.
  ACE: [3.5], ACH: [1.2], AJG: [1.1], AA: [1.6], ARQ: [42.3], AWA: [22], BFY: [8], BGQ: [1.9], BQI: [2.5],
  BAN: [3.3], BAL: [7.6], BJN: [3.5], BCI: [2.1], BA: [1.2], BAR: [14.1], BEJ: [1.2], BEM: [3.6], BEW: [5],
  BHB: [3.3], BIK: [2.5], BRX: [1.5], PCC: [2], BRH: [1.8], BUG: [5], WES: [2], YUE: [73.1], TZM: [4.5], SHU: [2.6],
  CE: [1.4], HNE: [16.3], CTG: [13], CV: [1.3], DGA: [1.1], DAG: [3.2], PRS: [9.6], DHD: [9.6], DIN: [1.4],
  DYU: [2.7], RMT: [1.3], CDO: [10.3], TAJ: [1.2], BIN: [1.6], EFI: [2.7], ARZ: [64.6], EGL: [1.3], FON: [1.9],
  FF: [24], GAN: [22.1], GBM: [3], GRT: [1], GPE: [5], GLK: [2.5], GON: [3], GOR: [1], GUW: [1.5], AYH: [4.5],
  HAK: [48.2], BGC: [14], MEY: [3.8], HAZ: [2.2], ACW: [14.5], HIL: [8.2], HOC: [1.5], CZH: [4.6], IBA: [2.3],
  IGL: [1.6], ACM: [15.7], TTS: [15], JAM: [3.2], CJY: [46.9], QUC: [2], KBD: [1.6], KBP: [1], KAB: [5.6],
  KBR: [1.5], KMC: [1.5], KAM: [3.9], KR: [15], PAM: [2.4], KAI: [1.8], KRJ: [1.1], KS: [6.9], KHG: [1.5],
  KHN: [1.5], CGG: [2.4], KI: [6.6], RN: [10.8], KG: [5], KFY: [2.3], KRU: [2], LKI: [1.5], LMN: [6], LAJ: [2.1],
  APC: [24.6], AYL: [4.3], LI: [1.6], LMO: [3.9], NDS: [5], LUA: [6.3], LUO: [3], MAD: [15], MAG: [20.7], MDH: [1.1],
  MAK: [1.6], VMW: [7.4], KDE: [1.7], MUP: [10], BTM: [1.1], MNK: [1.4], MWR: [14], MZN: [3.3], MNI: [1.5], WRY: [4],
  MTR: [5], WTM: [5], MIN: [5.5], ARY: [27.5], MOS: [7.6], UNR: [1.5], MTQ: [1.1], SCK: [7], NAP: [7.5], PCM: [4.7],
  NOE: [1.5], KXM: [1.4], LRC: [1.5], MNP: [11], ND: [1.6], NOD: [6], II: [2], NYN: [2.3], PFL: [1], PAG: [1.1],
  PMS: [2], CPX: [2.5], RAJ: [25], RHG: [1.8], RGN: [1.1], ROM: [3.5], KSW: [4], AEC: [22.4], SPV: [2.6],
  AYN: [11.4], SG: [4.6], SAT: [7.2], SKR: [20], SC: [1.3], SAS: [2], SCO: [1.5], SGW: [1.5], SRR: [1.2], SHN: [3],
  SHY: [2.3], SHK: [2], SCN: [4.7], SID: [1.8], SNK: [1.1], AZB: [13.8], SDH: [3], LUZ: [1], NAN: [50.1], SOU: [4.5],
  APD: [31.9], SUK: [5.4], SUS: [2.4], SS: [2], GSW: [10], SYL: [12], ACQ: [10.5], RIF: [4.4], SHI: [8], TSG: [1.1],
  BO: [1.2], BBC: [2], TPI: [4], TOI: [1.3], TSC: [1.2], TN: [4.5], TMH: [1.2], TCY: [2], TUM: [7], AEB: [11.6],
  TYZ: [1.5], UMB: [6], SXU: [2], URH: [1.1], VE: [1.3], VEC: [2], WAR: [3.1], VLS: [1.4], WAL: [5.8], WO: [3.7],
  WUU: [81.4], HSN: [37.3], ZZA: [1.6], ZA: [16],
};

type Pronunciation = readonly [engine: VoiceEngine, match: IpaMatch];

/**
 * The voice and what it was heard to do with IPA, per language. Each entry was listened to;
 * languages absent here have no tested voice. Where two engines work, the one listed is the
 * one the app will use first.
 */
const PRONUNCIATION: Partial<Record<LanguageCode, Pronunciation>> = {
  // Google Chirp 3 HD: follows the sounds and the stress.
  EN: ['Google Chirp 3 HD', 'stress'], DE: ['Google Chirp 3 HD', 'stress'], NL: ['Google Chirp 3 HD', 'stress'],
  ES: ['Google Chirp 3 HD', 'stress'], PT: ['Google Chirp 3 HD', 'stress'], IT: ['Google Chirp 3 HD', 'stress'],
  PL: ['Google Chirp 3 HD', 'stress'], RU: ['Google Chirp 3 HD', 'stress'], TR: ['Google Chirp 3 HD', 'stress'],
  AR: ['Google Chirp 3 HD', 'stress'], HI: ['Google Chirp 3 HD', 'stress'],
  // Google Chirp 3 HD: the language has no word stress in the engine's sound list.
  FR: ['Google Chirp 3 HD', 'no-stress'], ID: ['Google Chirp 3 HD', 'no-stress'], TA: ['Google Chirp 3 HD', 'no-stress'],
  KO: ['Google Chirp 3 HD', 'no-stress'], KN: ['Google Chirp 3 HD', 'no-stress'], ML: ['Google Chirp 3 HD', 'no-stress'],
  // Older Google voices: sounds and stress.
  UK: ['Google WaveNet', 'stress'], DA: ['Google WaveNet', 'stress'], FIL: ['Google Neural2', 'stress'],
  TL: ['Google Neural2', 'stress'], AF: ['Google Standard', 'stress'],
  // Older Google voices: sounds only.
  RO: ['Google WaveNet', 'sounds'], CA: ['Google Standard', 'sounds'], BG: ['Google Standard', 'sounds'],
  CS: ['Google WaveNet', 'sounds'], HU: ['Google WaveNet', 'sounds'], SK: ['Google WaveNet', 'sounds'],
  FI: ['Google WaveNet', 'sounds'], NO: ['Google WaveNet', 'sounds'], SV: ['Google WaveNet', 'sounds'],
  IS: ['Google Standard', 'sounds'], LV: ['Google Standard', 'sounds'], MS: ['Google WaveNet', 'sounds'],
  BN: ['Google WaveNet', 'sounds'], PA: ['Google WaveNet', 'sounds'], SR: ['Google Standard', 'sounds'],
  // Azure: sounds follow; stress has not been judged language by language yet.
  EL: ['Azure Neural', 'sounds'], HE: ['Azure Neural', 'sounds'], TH: ['Azure Neural', 'sounds'],
  VI: ['Azure Neural', 'sounds'], HR: ['Azure Neural', 'sounds'], SL: ['Azure Neural', 'sounds'],
  ZH: ['Azure Neural', 'sounds'], JA: ['Azure Neural', 'sounds'], MR: ['Azure Neural', 'sounds'],
  TE: ['Azure Neural', 'sounds'], UR: ['Azure Neural', 'sounds'], GU: ['Azure Neural', 'sounds'],
  // Azure, for languages the app had no voice for: sounds follow. The Arabic voices are tagged by country
  // and mostly read Standard Arabic with a regional accent, so they fit the spoken language loosely.
  AS: ['Azure Neural', 'sounds'], OR: ['Azure Neural', 'sounds'], YUE: ['Azure Neural', 'sounds'],
  ARZ: ['Azure Neural', 'sounds'], AEC: ['Azure Neural', 'sounds'], APC: ['Azure Neural', 'sounds'],
  ACM: ['Azure Neural', 'sounds'], AYL: ['Azure Neural', 'sounds'], ARY: ['Azure Neural', 'sounds'],
  ARQ: ['Azure Neural', 'sounds'], AEB: ['Azure Neural', 'sounds'], ACW: ['Azure Neural', 'sounds'],
  AYH: ['Azure Neural', 'sounds'], AYN: ['Azure Neural', 'sounds'], ACQ: ['Azure Neural', 'sounds'],
  // Azure has a voice that reads the spelling and ignores IPA.
  SQ: ['Azure Neural', 'not-followed'], HY: ['Azure Neural', 'not-followed'], AZ: ['Azure Neural', 'not-followed'],
  BS: ['Azure Neural', 'not-followed'], GA: ['Azure Neural', 'not-followed'], JV: ['Azure Neural', 'not-followed'],
  KK: ['Azure Neural', 'not-followed'], KM: ['Azure Neural', 'not-followed'], MK: ['Azure Neural', 'not-followed'],
  MT: ['Azure Neural', 'not-followed'], MN: ['Azure Neural', 'not-followed'], FA: ['Azure Neural', 'not-followed'],
  SI: ['Azure Neural', 'not-followed'], SO: ['Azure Neural', 'not-followed'], SU: ['Azure Neural', 'not-followed'],
  UZ: ['Azure Neural', 'not-followed'], CY: ['Azure Neural', 'not-followed'], WUU: ['Azure Neural', 'not-followed'],
  ZU: ['Azure Neural', 'not-followed'], AM: ['Azure Neural', 'not-followed'], KA: ['Azure Neural', 'not-followed'],
  LO: ['Azure Neural', 'not-followed'], MY: ['Azure Neural', 'not-followed'], NE: ['Azure Neural', 'not-followed'],
  PS: ['Azure Neural', 'not-followed'],
  // A voice exists and reads the spelling; neither provider follows IPA.
  EU: ['Google Standard', 'not-followed'], ET: ['Google Chirp 3 HD', 'not-followed'],
  GL: ['Google Standard', 'not-followed'], LT: ['Google Chirp 3 HD', 'not-followed'],
  SW: ['Google Chirp 3 HD', 'not-followed'],
};

/** Languages the book analysis can reduce to dictionary words. English is live because English books are published. */
const WORD_FORMS: readonly LanguageCode[] = [
  LanguageCode.CA, LanguageCode.DA, LanguageCode.DE, LanguageCode.EL, LanguageCode.EN, LanguageCode.ES,
  LanguageCode.FI, LanguageCode.FR, LanguageCode.HR, LanguageCode.IT, LanguageCode.JA, LanguageCode.KO,
  LanguageCode.LT, LanguageCode.MK, LanguageCode.NL, LanguageCode.NO, LanguageCode.PL, LanguageCode.PT,
  LanguageCode.RO, LanguageCode.RU, LanguageCode.SL, LanguageCode.SV, LanguageCode.UK, LanguageCode.ZH,
];

/** Frequency is on the word sheet today for these three; the others have a corpus waiting. */
const FREQUENCY_LIVE: readonly LanguageCode[] = [LanguageCode.EN, LanguageCode.DE, LanguageCode.RU];
const FREQUENCY_PLANNED: readonly LanguageCode[] = [
  LanguageCode.BG, LanguageCode.CA, LanguageCode.CS, LanguageCode.DA, LanguageCode.EL, LanguageCode.ES,
  LanguageCode.FI, LanguageCode.FR, LanguageCode.HR, LanguageCode.HU, LanguageCode.IS, LanguageCode.IT,
  LanguageCode.JA, LanguageCode.KO, LanguageCode.LT, LanguageCode.LV, LanguageCode.MK, LanguageCode.NL,
  LanguageCode.NO, LanguageCode.PL, LanguageCode.PT, LanguageCode.RO, LanguageCode.SK, LanguageCode.SL,
  LanguageCode.SV, LanguageCode.TR, LanguageCode.UK, LanguageCode.ZH,
];

/** The first languages to get stored dictionary entries with senses and levels. */
const ENTRIES_PLANNED: readonly LanguageCode[] = [
  LanguageCode.DE, LanguageCode.EN, LanguageCode.FR, LanguageCode.ES, LanguageCode.IT,
];

function capabilityOf(code: LanguageCode): LanguageCapability {
  const [nativeSpeakersMillions, ethnologue] = SPEAKERS[code];
  const pronunciation = PRONUNCIATION[code];
  return {
    code,
    nativeSpeakersMillions,
    speakersFromEthnologue: ethnologue === true,
    voice: pronunciation ? {status: 'ready', engine: pronunciation[0]} : {status: 'none'},
    ipaMatch: pronunciation ? pronunciation[1] : 'untested',
    wordForms: code === LanguageCode.EN ? 'live' : WORD_FORMS.includes(code) ? 'ready' : 'none',
    frequency: FREQUENCY_LIVE.includes(code) ? 'live' : FREQUENCY_PLANNED.includes(code) ? 'planned' : 'none',
    entries: ENTRIES_PLANNED.includes(code) ? 'planned' : 'none',
  };
}

/** One row per language the app lists, in the enum's order. */
export const LANGUAGE_CAPABILITIES: readonly LanguageCapability[] =
  (Object.values(LanguageCode) as LanguageCode[]).map(capabilityOf);

/** The date the table last changed, not the deploy date: bump it with the data. */
export const LANGUAGE_CAPABILITIES_UPDATED = new Date(2026, 9, 2);
