export interface TargetLanguageWithProficiency {
  language: string;
  cefrLevel: string;
}

export interface LanguageSetupRequest {
  fluentLangs: string[];
  targetLangsData: TargetLanguageWithProficiency[];
}
