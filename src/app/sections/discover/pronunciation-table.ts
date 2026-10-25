import {DiscoverPronunciation} from './discover.service';
import {SenseRow} from './word-sheet';

/** A transcription with its own speaker; `playable` is false when it has no clip and synthesis would say another. */
export interface PronunciationReading {
  pronunciation: DiscoverPronunciation;
  key: string;
  playable: boolean;
}

/**
 * A group of the card's senses that take exactly the same readings (design 7a), headed by their parts of speech and
 * their numbers in the sense list, which is how the header points at the list.
 */
export interface PronunciationColumn {
  /** `DiscoverSense.index` of each sense in the group. */
  senses: number[];
  partsOfSpeech: string;
  /** The senses' numbers in the list: "1–2", or "1, 3" when they are not contiguous. */
  numbers: string;
}

/** What one accent says for the columns from `column` on: one cell per column, or one spanning them all. */
export interface PronunciationCell {
  column: number;
  span: number;
  /** The readings, two to a line. */
  lines: PronunciationReading[][];
}

export interface PronunciationRow {
  variety: string;
  cells: PronunciationCell[];
}

/**
 * Accents are rows, meanings are columns (design 7a). A word whose readings do not follow the meaning (scenarios A
 * and B) has one column and no header, which is the stacked rows of design 5c.
 */
export interface PronunciationTable {
  /** Empty for a one-column word. */
  columns: PronunciationColumn[];
  rows: PronunciationRow[];
  /** Speakers greyed for want of a clip, which the one line under the table accounts for. */
  pending: number;
}

/** Variants a cell holds side by side before the rest move to a line under them. */
const VARIANTS_PER_LINE = 2;

/**
 * Builds the table from the pronunciations, the learner's accent first. Senses are grouped by the exact set of
 * readings they take across all accents, and the groups become columns in the order of their first sense in the list.
 * Within a column readings follow the learner's accent's ranking, applied to every accent so the columns stay
 * comparable down the table: a reading ranks with the learner's reading nearest it, and the accent's own order breaks
 * ties. A one-column word keeps each accent's own order, which says what is most common there (American niche). A row whose cells all hold the same readings collapses into one cell spanning them. Synthesis can only say
 * the spelling, which comes out as an accent's first reading, so past the first a reading plays only from its clip.
 */
export function pronunciationTable(pronunciations: DiscoverPronunciation[], senseRows: SenseRow[],
                                   partOfSpeechLabel: (partOfSpeech: string | null) => string): PronunciationTable {
  const byVariety = new Map<string, DiscoverPronunciation[]>();
  for (const pronunciation of pronunciations) {
    byVariety.set(pronunciation.variety, [...byVariety.get(pronunciation.variety) ?? [], pronunciation]);
  }
  const readings = new Map(pronunciations.map(pronunciation => [pronunciation, {
    pronunciation, key: speakerKey(pronunciation),
    playable: byVariety.get(pronunciation.variety)![0] === pronunciation || !!pronunciation.clipUrl,
  }]));
  const columns = senseColumns(pronunciations, senseRows, partOfSpeechLabel);
  const learner = byVariety.values().next().value ?? [];
  const rows = Array.from(byVariety, ([variety, said]) => {
    const cells = (columns.length ? columns : [null]).map((column, index) => {
      if (!column) return {column: index, span: 1, taken: said};
      const taken = said.filter(pronunciation => pronunciation.senses.includes(column.senses[0]));
      const reference = learner.filter(pronunciation => pronunciation.senses.includes(column.senses[0]));
      return {column: index, span: 1, taken: rankedLike(taken, reference)};
    });
    const same = cells.every(cell => sameReadings(cell.taken, cells[0].taken));
    const kept = same ? [{...cells[0], span: cells.length}] : cells;
    return {variety, cells: kept.map(({column, span, taken}) => ({column, span, lines: lines(taken.map(pronunciation => readings.get(pronunciation)!))}))};
  });
  const shown = new Set(rows.flatMap(row => row.cells.flatMap(cell => cell.lines.flat())).filter(reading => !reading.playable).map(reading => reading.key));
  return {columns, rows, pending: shown.size};
}

export function speakerKey(pronunciation: DiscoverPronunciation): string {
  return `pronunciation:${pronunciation.variety}:${pronunciation.ipa ?? ''}`;
}

/** The senses grouped by the readings they take; none when every sense takes the same ones. */
function senseColumns(pronunciations: DiscoverPronunciation[], senseRows: SenseRow[],
                      partOfSpeechLabel: (partOfSpeech: string | null) => string): PronunciationColumn[] {
  const groups = new Map<string, SenseRow[]>();
  for (const row of [...senseRows].sort((a, b) => a.number - b.number)) {
    const taking = pronunciations.filter(pronunciation => pronunciation.senses.includes(row.sense.index)).map(speakerKey);
    if (!taking.length) continue;
    const key = taking.sort().join('\n');
    groups.set(key, [...groups.get(key) ?? [], row]);
  }
  if (groups.size < 2) return [];
  return Array.from(groups.values(), rows => ({
    senses: rows.map(row => row.sense.index),
    partsOfSpeech: [...new Set(rows.map(row => partOfSpeechLabel(row.sense.partOfSpeech)).filter(Boolean))].join(', '),
    numbers: numberRanges(rows.map(row => row.number)),
  }));
}

/** 1, 2, 3, 5 as "1–3, 5". */
export function numberRanges(numbers: number[]): string {
  const ranges: string[] = [];
  for (let start = 0; start < numbers.length;) {
    let end = start;
    while (end + 1 < numbers.length && numbers[end + 1] === numbers[end] + 1) end++;
    ranges.push(end === start ? `${numbers[start]}` : `${numbers[start]}–${numbers[end]}`);
    start = end + 1;
  }
  return ranges.join(', ');
}

/** The readings ordered by the rank of the reference reading nearest each, their own order breaking ties. */
function rankedLike(readings: DiscoverPronunciation[], reference: DiscoverPronunciation[]): DiscoverPronunciation[] {
  if (!reference.length || readings === reference) return readings;
  const rank = (reading: DiscoverPronunciation) => {
    let best = 0;
    reference.forEach((candidate, index) => {
      if (distance(reading.ipa, candidate.ipa) < distance(reading.ipa, reference[best].ipa)) best = index;
    });
    return best;
  };
  return readings.map((reading, index) => ({reading, index, rank: rank(reading)}))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({reading}) => reading);
}

/** Edit distance between two transcriptions, by code point, slashes and syllable dots aside. */
function distance(a: string | null, b: string | null): number {
  const first = Array.from((a ?? '').replace(/[/.]/g, ''));
  const second = Array.from((b ?? '').replace(/[/.]/g, ''));
  let previous = Array.from({length: second.length + 1}, (_, index) => index);
  for (let i = 1; i <= first.length; i++) {
    const current = [i];
    for (let j = 1; j <= second.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[second.length];
}

function sameReadings(a: DiscoverPronunciation[], b: DiscoverPronunciation[]): boolean {
  return a.length === b.length && a.every((reading, index) => reading === b[index]);
}

function lines(readings: PronunciationReading[]): PronunciationReading[][] {
  const result: PronunciationReading[][] = [];
  for (let start = 0; start < readings.length; start += VARIANTS_PER_LINE) result.push(readings.slice(start, start + VARIANTS_PER_LINE));
  return result;
}
