import {LanguageCode} from '../models/language.enum';

/**
 * Which English, which German (design V, table V5). One row per variety a learner may pick, keyed by its BCP-47
 * tag; the backend holds the same table as `LanguageVariety` and validates what is sent. The first entry of a
 * language is its default. A language absent from the map has one supported variety and never shows the row.
 *
 * Pill labels are places, not adjectives, wherever the adjective would be awkward or contested; English is the
 * exception because "American / British" is how learners already say it. The helper line under the pills says
 * what the choice changes, in one sentence, and is honest about what it cannot do.
 */
export interface LanguageVariety {
  /** BCP-47 tag: what is stored on the learner and sent to the API. */
  tag: string;
  /** The pill label and the closed select's text: "American", "Switzerland". */
  label: string;
  /** The full name for a control's accessible label and any sentence: "American English". */
  name: string;
}

export interface LanguageVarietyRow {
  /** The question above the pills: "Which English?". */
  question: string;
  /** What the setting changes, one line under the pills. */
  helper: string;
  varieties: LanguageVariety[];
}

const HELPER_VOICE_SPELLING_SENSE = $localize`Sets the voice you hear, the spelling you see, and which meaning comes first. Every other variety stays one tap away.`;
const HELPER_VOICE_WORDS = $localize`Sets the voice you hear and which words come first. Every other variety stays one tap away.`;

export const LANGUAGE_VARIETIES: Partial<Record<LanguageCode, LanguageVarietyRow>> = {
  [LanguageCode.EN]: {
    question: $localize`Which English?`,
    helper: HELPER_VOICE_SPELLING_SENSE,
    varieties: [
      {tag: 'en-US', label: $localize`American`, name: $localize`American English`},
      {tag: 'en-GB', label: $localize`British`, name: $localize`British English`},
      {tag: 'en-AU', label: $localize`Australian`, name: $localize`Australian English`},
      {tag: 'en-IN', label: $localize`Indian`, name: $localize`Indian English`},
    ],
  },
  [LanguageCode.ES]: {
    question: $localize`Which Spanish?`,
    helper: HELPER_VOICE_WORDS,
    varieties: [
      {tag: 'es-ES', label: $localize`Spain`, name: $localize`European Spanish`},
      {tag: 'es-MX', label: $localize`Mexico`, name: $localize`Mexican Spanish`},
      {tag: 'es-AR', label: $localize`Argentina`, name: $localize`Argentine Spanish`},
      {tag: 'es-CO', label: $localize`Colombia`, name: $localize`Colombian Spanish`},
    ],
  },
  [LanguageCode.PT]: {
    question: $localize`Which Portuguese?`,
    helper: HELPER_VOICE_SPELLING_SENSE,
    varieties: [
      {tag: 'pt-BR', label: $localize`Brazil`, name: $localize`Brazilian Portuguese`},
      {tag: 'pt-PT', label: $localize`Portugal`, name: $localize`European Portuguese`},
    ],
  },
  [LanguageCode.FR]: {
    question: $localize`Which French?`,
    helper: HELPER_VOICE_WORDS,
    varieties: [
      {tag: 'fr-FR', label: $localize`France`, name: $localize`French of France`},
      {tag: 'fr-CA', label: $localize`Canada`, name: $localize`Canadian French`},
      {tag: 'fr-BE', label: $localize`Belgium`, name: $localize`Belgian French`},
      {tag: 'fr-CH', label: $localize`Switzerland`, name: $localize`Swiss French`},
    ],
  },
  [LanguageCode.DE]: {
    question: $localize`Which German?`,
    helper: $localize`Swiss Standard German: no ß, Swiss words first, a Swiss voice. Dialect is not on offer, and we say so.`,
    varieties: [
      {tag: 'de-DE', label: $localize`Germany`, name: $localize`German of Germany`},
      {tag: 'de-AT', label: $localize`Austria`, name: $localize`Austrian German`},
      {tag: 'de-CH', label: $localize`Switzerland`, name: $localize`Swiss Standard German`},
    ],
  },
  [LanguageCode.NL]: {
    question: $localize`Which Dutch?`,
    helper: HELPER_VOICE_WORDS,
    varieties: [
      {tag: 'nl-NL', label: $localize`Netherlands`, name: $localize`Dutch of the Netherlands`},
      {tag: 'nl-BE', label: $localize`Belgium`, name: $localize`Belgian Dutch`},
    ],
  },
  [LanguageCode.ZH]: {
    question: $localize`Which Chinese?`,
    helper: HELPER_VOICE_WORDS,
    varieties: [
      {tag: 'zh-CN', label: $localize`Mainland`, name: $localize`Mainland Chinese`},
      {tag: 'zh-TW', label: $localize`Taiwan`, name: $localize`Taiwanese Mandarin`},
    ],
  },
};

/** The row for a language, or null when it has one supported variety and nothing to ask. */
export function varietyRow(language: LanguageCode): LanguageVarietyRow | null {
  return LANGUAGE_VARIETIES[language] ?? null;
}

/** What a learner holds until they say otherwise. */
export function defaultVariety(language: LanguageCode): LanguageVariety | null {
  return varietyRow(language)?.varieties[0] ?? null;
}

/** The catalogue entry behind a stored tag; the default when the tag is missing or unknown to this build. */
export function varietyOf(language: LanguageCode, tag: string | null | undefined): LanguageVariety | null {
  const row = varietyRow(language);
  if (!row) return null;
  return row.varieties.find(variety => variety.tag.toLowerCase() === tag?.toLowerCase()) ?? row.varieties[0];
}
