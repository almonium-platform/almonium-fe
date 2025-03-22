import {Language} from "../../models/language.model";
import {CEFRLevel} from "../../models/userinfo.model";

export interface Book {
  id: string;
  title: string;
  author: string;
  publicationYear: number;
  coverImageUrl: string;
  wordCount: number;
  rating: number;
  language: Language;
  levelFrom: CEFRLevel;
  levelTo: CEFRLevel;
  progressPercentage: number | null;
  isTranslation: boolean;
  hasParallelTranslation: boolean;
  hasTranslation: boolean;
}

export interface BookshelfView {
  continueReading: Book[];
  recommended: Book[];
}
