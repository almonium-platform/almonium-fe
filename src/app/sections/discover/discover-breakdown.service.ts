import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {delay} from 'rxjs/operators';
import {LanguageCode} from '../../models/language.enum';

export type BreakdownNoteKind = 'tense' | 'case' | 'idiom' | 'order';

export interface BreakdownNote {
  kind: BreakdownNoteKind;
  /** The words of the sentence the note is about, as they appear in it. */
  span: string;
  detail: string;
}

export interface BreakdownSentence {
  text: string;
  translation: string | null;
  notes: BreakdownNote[];
}

export interface DiscoverBreakdown {
  /** The language the text was read in; differs from the one asked for when the text was plainly another. */
  language: LanguageCode;
  sentences: BreakdownSentence[];
}

export interface PrivateText {
  title: string;
  characters: number;
}

/**
 * MOCK. The backend has no breakdown, private-text or language-detection endpoint yet, so this stands in for
 * all three with canned sentences and a stop-word guess. Replace the method bodies with HTTP calls; the
 * component depends only on these shapes.
 */
@Injectable({providedIn: 'root'})
export class DiscoverBreakdownService {
  breakdown(text: string, language: LanguageCode): Observable<DiscoverBreakdown> {
    const read = detectLanguage(text) ?? language;
    const sentences = splitSentences(text).map(sentence => FIXTURES[normalise(sentence)] ?? {text: sentence, translation: null, notes: []});
    return of({language: read, sentences}).pipe(delay(450));
  }

  saveToReader(text: string): Observable<PrivateText> {
    const words = text.trim().split(/\s+/);
    const title = words.slice(0, 6).join(' ') + (words.length > 6 ? '…' : '');
    return of({title, characters: text.trim().length}).pipe(delay(450));
  }
}

/** Sentences as the reader sees them: split after closing punctuation, keeping it. */
export function splitSentences(text: string): string[] {
  return text.trim().replace(/\s+/g, ' ').match(/[^.!?…]+(?:[.!?…]+["»“”’]?|$)/g)?.map(value => value.trim()).filter(Boolean) ?? [];
}

const STOP_WORDS: Partial<Record<LanguageCode, ReadonlySet<string>>> = {
  [LanguageCode.DE]: new Set('der die das und ist nicht ein eine ich sie er mit zu den dem des auf sich auch wenn noch'.split(' ')),
  [LanguageCode.FR]: new Set('le la les et est un une des du je il elle pas que qui dans pour ce sur avec'.split(' ')),
  [LanguageCode.ES]: new Set('el la los las y es un una que de no en por con se del muy pero'.split(' ')),
  [LanguageCode.IT]: new Set('il lo la gli e è un una che di non per con del della sono questo'.split(' ')),
  [LanguageCode.PL]: new Set('i w nie się na że z do to jest jak tak ale co'.split(' ')),
  [LanguageCode.PT]: new Set('o a os as e é um uma que de não em para com do da muito'.split(' ')),
  [LanguageCode.EN]: new Set('the and is a of to in that it was he she not with for this'.split(' ')),
};

/**
 * The language a text is plainly in, or null when it is not plain. Short or ambiguous text (die, also, pain)
 * stays in the language the reader chose; only a clear majority of one language's function words overrides it.
 */
export function detectLanguage(text: string): LanguageCode | null {
  const words = text.toLocaleLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length < 4) return null;
  const scores = Object.entries(STOP_WORDS)
    .map(([language, stops]) => ({language: language as LanguageCode, score: words.filter(word => stops.has(word)).length}))
    .sort((a, b) => b.score - a.score);
  const [top, second] = scores;
  return top.score >= 3 && top.score >= 2 * second.score ? top.language : null;
}

function normalise(sentence: string): string {
  return sentence.trim().replace(/\s+/g, ' ');
}

const FIXTURES: Record<string, BreakdownSentence> = Object.fromEntries(([
  {
    text: 'Die neueste Ausgabe lag ungelesen dort, während der Vater mit dem Rücken zum Fenster saß.',
    translation: 'The latest issue lay there unread while the father sat with his back to the window.',
    notes: [
      {kind: 'tense', span: 'lag … saß', detail: 'Präteritum of liegen and sitzen: the written past of a story, not the spoken one.'},
      {kind: 'order', span: 'während der Vater … saß', detail: 'während opens a subordinate clause, so the verb waits until the end.'},
      {kind: 'case', span: 'mit dem Rücken', detail: 'mit always takes the dative: der Rücken becomes dem Rücken.'},
    ],
  },
  {
    text: 'Als Gregor Samsa eines Morgens aus unruhigen Träumen erwachte, fand er sich in seinem Bett zu einem ungeheueren Ungeziefer verwandelt.',
    translation: 'When Gregor Samsa woke one morning from troubled dreams, he found himself transformed in his bed into a monstrous vermin.',
    notes: [
      {kind: 'case', span: 'eines Morgens', detail: 'A genitive of time: "one morning", with no preposition.'},
      {kind: 'order', span: 'Als … erwachte, fand er', detail: 'The als clause fills the first position, so the main verb fand comes straight after it, before its subject.'},
      {kind: 'idiom', span: 'sich verwandelt finden', detail: 'To find oneself turned into something: the state is reported, not the change.'},
    ],
  },
  {
    text: 'Er lag auf seinem panzerartig harten Rücken.',
    translation: 'He lay on his armour-hard back.',
    notes: [{kind: 'case', span: 'auf seinem … Rücken', detail: 'auf with the dative for where something is, not where it goes.'}],
  },
  {
    text: 'Il pleut des cordes depuis ce matin.',
    translation: 'It has been pouring since this morning.',
    notes: [
      {kind: 'idiom', span: 'pleuvoir des cordes', detail: 'Literally "to rain ropes": to pour.'},
      {kind: 'tense', span: 'pleut depuis', detail: 'French uses the present with depuis where English uses "has been".'},
    ],
  },
] satisfies BreakdownSentence[]).map(sentence => [normalise(sentence.text), sentence]));
