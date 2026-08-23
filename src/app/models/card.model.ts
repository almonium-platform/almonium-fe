import {expectArray, expectBoolean, expectNumber, expectRecord, expectString} from '../shared/runtime-validation';

export interface TranslationDto {
  id: string;
  translation: string;
}

export interface TagDto {
  text: string;
}

export interface ExampleDto {
  id: string;
  example: string;
  translation: string;
}

export interface CardDto {
  id?: string;
  publicId?: string;
  userId?: string;
  entry: string;
  language: string;
  translations: TranslationDto[];
  notes?: string;
  tags?: TagDto[];
  examples?: ExampleDto[];
  createdAt?: string;
  updatedAt?: string;
  iteration?: number;
  priority?: number;
  activeLearning?: boolean;
  irregularPlural?: boolean;
  irregularSpelling?: boolean;
  falseFriend?: boolean;
  normalizedForm?: string;
  lemma?: string;
  itemType?: LearningItemType;
  partOfSpeech?: string;
  selectedSense?: string;
  sourceContext?: string;
  learningIntents?: LearningIntent[];
}

export type LearningIntent = 'UNDERSTAND' | 'PRODUCE' | 'PRONOUNCE' | 'DISAMBIGUATE' | 'CHUNK';
export type LearningItemType = 'WORD' | 'PHRASE' | 'CHUNK' | 'TEMPLATE';

export interface CardCreationDto {
  entry: string;
  language: string;
  translations: {translation: string}[];
  partOfSpeech?: string;
  selectedSense?: string;
  sourceContext?: string;
  learningIntents: LearningIntent[];
  itemType: LearningItemType;
  examples: {example: string; translation: string}[];
  activeLearning: boolean;
  learnt: boolean;
  priority: number;
}

export function parseCards(value: unknown): CardDto[] {
  return expectArray(value, 'cards').map((item, index) => {
    const card = expectRecord(item, `cards[${index}]`);
    const parsed: CardDto = {
      entry: expectString(card['entry'], `cards[${index}].entry`),
      language: expectString(card['language'], `cards[${index}].language`),
      translations: expectArray(card['translations'], `cards[${index}].translations`).map((translation, translationIndex) => {
        const value = expectRecord(translation, `cards[${index}].translations[${translationIndex}]`);
        return {
          id: expectString(value['id'], `cards[${index}].translations[${translationIndex}].id`),
          translation: expectString(value['translation'], `cards[${index}].translations[${translationIndex}].translation`),
        };
      }),
    };
    const optionalStrings = ['id', 'publicId', 'userId', 'notes', 'createdAt', 'updatedAt', 'normalizedForm', 'lemma', 'partOfSpeech', 'selectedSense', 'sourceContext'] as const;
    optionalStrings.forEach(key => {
      if (card[key] !== undefined && card[key] !== null) {
        parsed[key] = expectString(card[key], `cards[${index}].${key}`);
      }
    });
    if (card['tags'] !== undefined && card['tags'] !== null) {
      parsed.tags = expectArray(card['tags'], `cards[${index}].tags`).map((tag, tagIndex) => {
        const item = expectRecord(tag, `cards[${index}].tags[${tagIndex}]`);
        return {text: expectString(item['text'], `cards[${index}].tags[${tagIndex}].text`)};
      });
    }
    if (card['examples'] !== undefined && card['examples'] !== null) {
      parsed.examples = expectArray(card['examples'], `cards[${index}].examples`).map((example, exampleIndex) => {
        const item = expectRecord(example, `cards[${index}].examples[${exampleIndex}]`);
        return {
          id: expectString(item['id'], `cards[${index}].examples[${exampleIndex}].id`),
          example: expectString(item['example'], `cards[${index}].examples[${exampleIndex}].example`),
          translation: expectString(item['translation'], `cards[${index}].examples[${exampleIndex}].translation`),
        };
      });
    }
    if (card['itemType'] !== undefined && card['itemType'] !== null) {
      parsed.itemType = expectString(card['itemType'], `cards[${index}].itemType`) as LearningItemType;
    }
    if (card['learningIntents'] !== undefined && card['learningIntents'] !== null) {
      parsed.learningIntents = expectArray(card['learningIntents'], `cards[${index}].learningIntents`)
        .map((intent, intentIndex) => expectString(intent, `cards[${index}].learningIntents[${intentIndex}]`) as LearningIntent);
    }
    const optionalNumbers = ['iteration', 'priority'] as const;
    optionalNumbers.forEach(key => {
      if (card[key] !== undefined && card[key] !== null) {
        parsed[key] = expectNumber(card[key], `cards[${index}].${key}`);
      }
    });
    const optionalBooleans = ['activeLearning', 'irregularPlural', 'irregularSpelling', 'falseFriend'] as const;
    optionalBooleans.forEach(key => {
      if (card[key] !== undefined && card[key] !== null) {
        parsed[key] = expectBoolean(card[key], `cards[${index}].${key}`);
      }
    });
    return parsed;
  });
}
