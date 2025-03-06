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
