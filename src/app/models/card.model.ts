export interface TranslationDto {
  id: number;
  translation: string;
}

export interface TagDto {
  text: string;
}

export interface ExampleDto {
  id: number;
  example: string;
  translation: string;
}

export interface CardDto {
  id?: number;
  publicId?: string;
  userId?: number;
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
