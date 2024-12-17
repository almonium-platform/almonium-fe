import {Injectable} from '@angular/core';
import iso6391 from 'iso-639-1';
import {iso6393} from 'iso-639-3';
import {Language} from "../models/language.model";
import {LanguageCode} from "../models/language.enum";

@Injectable({
  providedIn: 'root',
})
export class LanguageNameService {
  /**
   * Converts a language code (e.g., 'EN') into its full language name (e.g., 'English').
   * @param code Language code to transform.
   * @returns Full name of the language, or the code itself if not found.
   */
  getLanguageName(code: string): string {
    let name: string | undefined;

    // First, try iso-639-1 (for two-letter codes)
    if (code.length === 2) {
      name = iso6391.getName(code.toLowerCase());
    }

    // If not found or code is longer, try iso-639-3 (for three-letter codes)
    if (!name && code.length === 3) {
      const language = iso6393.find((lang) => lang.iso6393 === code.toLowerCase());
      name = language ? language.name : undefined;
    }

    // Return the name if found, otherwise return the code in uppercase as a fallback
    return name || code.toUpperCase();
  }

  public mapLanguageCodesToNames(languages: Language[], languageCodes: string[]) {
    return languageCodes
      .map((code) => {
        const lang = languages.find((l) => l.code === code);
        return lang ? lang.name : null;
      })
      .filter((name): name is string => name !== null);
  }

  public mapLanguageNamesToCodes(languages: Language[], languageNames: string[]): LanguageCode[] {
    return languageNames
      .map((name) => this.mapLanguageNameToCode(languages, name))
      .filter((code): code is LanguageCode => code !== null);
  }

  public mapLanguageNameToCode(languages: Language[], name: string): LanguageCode | null {
    const lang = languages.find((l) => l.name === name);
    return lang ? (lang.code.toUpperCase() as LanguageCode) : null;
  }
}
