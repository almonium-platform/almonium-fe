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
}

export interface BookshelfView {
  continueReading: Book[];
  recommended: Book[];
}
