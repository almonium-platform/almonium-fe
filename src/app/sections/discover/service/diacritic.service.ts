import {Injectable} from '@angular/core';
import {DiacriticOptions} from "../diacritic-options.model";

@Injectable({
  providedIn: 'root',
})
export class DiacriticService {
  private diacriticOptions: DiacriticOptions = {
    FR: {
      a: ['à', 'â'],
      e: ['é', 'è', 'ê', 'ë'],
      i: ['î', 'ï'],
      o: ['ô', 'œ', 'ö'],
      u: ['ù', 'û', 'ü'],
      c: ['ç'],
    },
    DE: {
      a: ['ä'],
      o: ['ö'],
      u: ['ü'],
      s: ['ß'],
    },
    ES: {
      a: ['á'],
      e: ['é'],
      i: ['í'],
      o: ['ó'],
      u: ['ú', 'ü'],
      n: ['ñ'],
    },
    IT: {
      a: ['à'],
      e: ['è', 'é'],
      i: ['ì'],
      o: ['ò', 'ó'],
      u: ['ù'],
    },
    PL: {
      a: ['ą'],
      c: ['ć'],
      e: ['ę'],
      l: ['ł'],
      n: ['ń'],
      o: ['ó'],
      s: ['ś'],
      z: ['ź', 'ż'],
    },
    PT: {
      a: ['á', 'â', 'ã'],
      e: ['é', 'ê'],
      i: ['í'],
      o: ['ó', 'ô', 'õ'],
      u: ['ú'],
      c: ['ç'],
    },
    NL: {
      a: ['á'],
      e: ['é'],
      i: ['í'],
      o: ['ó'],
      u: ['ú'],
    },
    SV: {
      a: ['å', 'ä'],
      o: ['ö'],
    },
    DA: {
      a: ['å', 'æ'],
      o: ['ø'],
    },
    FI: {
      a: ['ä'],
      o: ['ö'],
    },
    NO: {
      a: ['å'],
      o: ['ø'],
    },
  };

  constructor() {
  }

  /** Get diacritic options for a given character and language */
  getDiacriticOptions(lastLetter: string, language: string): string[] {
    const lowerLetter = lastLetter.toLowerCase();
    const options = this.diacriticOptions[language as keyof DiacriticOptions]?.[lowerLetter] || [];

    // If the last letter is uppercase, convert options to uppercase, except for 'ß'
    return lastLetter === lastLetter.toUpperCase()
      ? options.filter(option => option !== 'ß').map(option => option.toUpperCase())
      : options;
  }

  /** Find the first index where two strings differ */
  findChangeIndex(previous: string, current: string): number | null {
    const minLength = Math.min(previous.length, current.length);

    for (let i = 0; i < minLength; i++) {
      if (previous[i] !== current[i]) {
        return i;
      }
    }

    if (previous.length !== current.length) {
      return minLength;
    }

    return null;
  }
}
