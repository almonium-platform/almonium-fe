import {CEFRLevel, SenseLead} from '../../models/userinfo.model';
import {DiscoverSense} from './discover.service';

/** A bare lookup shows this many senses; "Show N more" opens the rest in place (design 5a). */
export const SENSES_SHOWN = 3;

/** One sense as a row of the sheet: its place in the numbering and the parts of its one example. */
export interface SenseRow {
  sense: DiscoverSense;
  /** 1-based, running across the part-of-speech groups. */
  number: number;
  example: ExampleParts | null;
}

export interface SenseGroup {
  partOfSpeech: string | null;
  rows: SenseRow[];
}

/** The example split around the looked-up word, which the sheet sets in plum; `word` is empty when it is not found. */
export interface ExampleParts {
  text: string;
  before: string;
  word: string;
  after: string;
}

/**
 * Senses in groups by part of speech. The server sends them most frequent first; a group sits where its first
 * sense does, keeps its senses in the server's order, and numbering runs across groups.
 */
export function groupSenses(senses: DiscoverSense[]): SenseRow[] {
  const order: (string | null)[] = [];
  const byPart = new Map<string | null, DiscoverSense[]>();
  for (const sense of senses) {
    const part = sense.partOfSpeech;
    if (!byPart.has(part)) {
      byPart.set(part, []);
      order.push(part);
    }
    byPart.get(part)!.push(sense);
  }
  return order.flatMap(part => byPart.get(part)!).map((sense, index) => ({
    sense, number: index + 1, example: exampleParts(sense.examples[0]?.text ?? null, sense.headword),
  }));
}

/** Consecutive rows of one part of speech, as the sheet heads them. */
export function toGroups(rows: SenseRow[]): SenseGroup[] {
  const groups: SenseGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last?.partOfSpeech === row.sense.partOfSpeech) last.rows.push(row);
    else groups.push({partOfSpeech: row.sense.partOfSpeech, rows: [row]});
  }
  return groups;
}

/** How many of the hidden rows each part of speech holds, in the order they would appear. */
export function hiddenCounts(rows: SenseRow[]): {partOfSpeech: string | null; count: number}[] {
  return toGroups(rows).map(group => ({partOfSpeech: group.partOfSpeech, count: group.rows.length}));
}

/**
 * Whether a sense leads with its definition rather than its translation. Match my level leads with the
 * translation at A1 and A2 and with the definition from B1; with no level known, the translation leads.
 */
export function leadsWithDefinition(lead: SenseLead, level: CEFRLevel | null): boolean {
  if (lead !== 'level') return lead === 'definition';
  return level !== null && level !== CEFRLevel.A1 && level !== CEFRLevel.A2;
}

/** Five bars for the frequency mark: one per fifth of the relative corpus score, at least one. */
export function frequencyBars(score: number): number {
  return Math.min(5, Math.max(1, Math.ceil(score / 20)));
}

/** Finds the headword in its example, as typed or inflected (it begins the matched word), to set it apart. */
export function exampleParts(text: string | null, headword: string): ExampleParts | null {
  if (!text) return null;
  const stem = headword.trim().toLocaleLowerCase();
  const words = text.matchAll(/[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu);
  for (const match of words) {
    if (stem && match[0].toLocaleLowerCase().startsWith(stem)) {
      const start = match.index ?? 0;
      return {text, before: text.slice(0, start), word: match[0], after: text.slice(start + match[0].length)};
    }
  }
  return {text, before: text, word: '', after: ''};
}
