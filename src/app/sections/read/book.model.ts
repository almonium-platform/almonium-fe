import {CEFRLevel} from "../../models/userinfo.model";
import {LanguageCode} from "../../models/language.enum";

export interface Book {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  coverImageUrl: string;
  wordCount: number;
  rating: number;
  language: LanguageCode;
  levelFrom: CEFRLevel;
  levelTo: CEFRLevel;
  progressPercentage: number | null;
  isTranslation: boolean;
  hasParallelTranslation: boolean;
  hasTranslation: boolean;
  description: string;
  languageVariants: BookLanguageVariant[];
  favorite: boolean;
  orderLanguage?: LanguageCode;
  originalLanguage?: LanguageCode;
  originalId?: number;
  translator?: string;
}

export interface BookMiniDetails {
  progressPercentage: number;
  languageVariants: BookLanguageVariant[];
  language: LanguageCode;
}

export interface BookLanguageVariant {
  id: number;
  language: string;
}

export interface BookshelfView {
  continueReading: Book[];
  available: Book[];
  favorites: Book[];
}
