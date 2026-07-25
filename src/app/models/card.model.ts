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
}

export function parseCards(value: unknown): CardDto[] {
  return expectArray(value, 'cards').map((item, index) => {
    const card = expectRecord(item, `cards[${index}]`);
    return {
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
  });
}
import {expectArray, expectRecord, expectString} from '../shared/runtime-validation';
