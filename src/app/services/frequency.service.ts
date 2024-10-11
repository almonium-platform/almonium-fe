import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError, map} from 'rxjs/operators';
import {Language} from "../models/language.enum";

interface NgramsResponseDto {
  queryTokens: QueryToken[];
  ngrams: Ngram[];
}

interface QueryToken {
  text: string;
  type: string;
}

interface Ngram {
  id: string;
  abstract: boolean;
  absTotalMatchCount: number;
  relTotalMatchCount: number;
  tokens: QueryToken[];
}

@Injectable({
  providedIn: 'root',
})
export class FrequencyService {
  private readonly LOWEST_SCORE = 1;
  private readonly EXPONENT = 9;
  private readonly FREQUENCY_THRESHOLD = Math.pow(10, -this.EXPONENT);

  // Map language to its specific scale as defined in the backend
  private readonly languageScale: Map<Language, number> = new Map([
    [Language.EN, 12.78990589161462],
    [Language.RU, 10.5], // Replace with actual RU scale
    [Language.DE, 11.3], // Replace with actual DE scale
    // Continue for other languages
  ]);

  // Map language to corpus name as per ngrams.dev API
  private readonly corpusName: Map<Language, string> = new Map([
    [Language.EN, 'eng'],
    [Language.RU, 'rus'],
    [Language.DE, 'ger'],
    // Add other languages and their corpus names as needed
  ]);

  constructor(private http: HttpClient) {
  }

  /**
   * Fetches frequency data for a given word using the ngrams.dev API.
   * @param word The word to fetch frequency for.
   * @param language The language of the word.
   * @returns Observable<number> representing the calculated frequency score.
   */
  getFrequency(word: string, language: Language = Language.EN): Observable<number> {
    const corpus = this.corpusName.get(language);
    if (!corpus) {
      console.error(`Language ${language} is not supported.`);
      return of(0); // Or handle as per your application's requirement
    }

    const apiUrl = `https://api.ngrams.dev/${corpus}/search?query=${encodeURIComponent(word)}&flags=cr`;

    return this.http.get<NgramsResponseDto>(apiUrl).pipe(
      map(response => {
        if (response.ngrams && response.ngrams.length > 0) {
          const relFrequency = response.ngrams[0].relTotalMatchCount;
          console.log(`Word: ${word}, Raw relTotalMatchCount: ${relFrequency}`);
          const calculatedFrequency = this.calculateFrequency(relFrequency, language);
          console.log(`Word: ${word}, Calculated Frequency: ${calculatedFrequency}`);
          return calculatedFrequency;
        }
        console.warn(`No ngrams data found for word: ${word}`);
        return 0; // Default frequency if not found
      }),
      catchError(error => {
        console.error('Error fetching frequency data from ngrams.dev:', error);
        return of(0); // Return a default value in case of error
      })
    );
  }

  /**
   * Calculates the frequency score based on the provided relative frequency value.
   * This mimics the backend frequency calculation logic.
   * @param frequency The relative frequency value from ngrams.dev.
   * @param language The language of the word.
   * @returns The calculated frequency score.
   */
  private calculateFrequency(frequency: number, language: Language): number {
    if (frequency === 0) {
      return 0;
    }
    if (frequency < this.FREQUENCY_THRESHOLD) {
      return this.LOWEST_SCORE;
    }
    const scale = this.languageScale.get(language) || 1; // Default scale if language not found
    const normalizeByZero = Math.log10(frequency) + this.EXPONENT;
    const result = scale * normalizeByZero + this.LOWEST_SCORE;
    return Math.round(result);
  }
}
