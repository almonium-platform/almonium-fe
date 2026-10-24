/** A piece of a transcription, and whether it differs from the same place in the other varieties' transcriptions. */
export interface IpaSegment {
  text: string;
  differs: boolean;
}

/** One transcription split for display: its delimiters kept, its phonemes marked where the varieties part. */
export interface IpaLine {
  open: string;
  close: string;
  segments: IpaSegment[];
}

/**
 * Closing diphthongs and affricates are one phoneme, so a diff never splits them (noʊ / nəʊ is one change).
 * Centring ones (ɪə, eə, ʊə) are left as two: against a rhotic accent's ɪr the ɪ is shared and only ə / r differ.
 */
const UNITS = new Set(['eɪ', 'aɪ', 'ɔɪ', 'oʊ', 'əʊ', 'aʊ', 'ɑɪ', 'ɑʊ', 'æʊ', 'ɐʊ', 'ɒʊ', 'ɜʊ', 'ɛɪ', 'ɔʏ', 'tʃ', 'dʒ', 'ts', 'pf']);

/** Symbols that spell the same sound by two conventions; they compare equal (ɹi / ri is not a difference). */
const SAME_SOUND: Record<string, string> = {'ɹ': 'r', 'ɡ': 'g', 'ɝ': 'ɜr', 'ɚ': 'ər'};

/** Marks that belong to the symbol before them: length, aspiration, palatalisation, rhotic hook. */
const MODIFIERS = /[ːˑʰʷʲˠˤ˞]/u;

/**
 * Splits each transcription into phonemes and marks those that do not line up with every other transcription.
 * Lines are compared with the first by their longest common run of phonemes; the first line carries every
 * difference any other line has with it.
 */
export function diffTranscriptions(transcriptions: string[]): IpaLine[] {
  const lines = transcriptions.map(parse);
  const keys = lines.map(line => line.phonemes.map(key));
  const differs = lines.map(line => line.phonemes.map(() => false));
  for (let other = 1; other < lines.length; other++) {
    const [first, second] = unmatched(keys[0], keys[other]);
    first.forEach(index => differs[0][index] = true);
    second.forEach(index => differs[other][index] = true);
  }
  return lines.map((line, index) => ({
    open: line.open,
    close: line.close,
    segments: merge(line.phonemes.map((text, position) => ({text, differs: differs[index][position]}))),
  }));
}

/** Whether every transcription says the same thing, by sound rather than by spelling. */
export function sameTranscriptions(transcriptions: string[]): boolean {
  const keys = transcriptions.map(transcription => parse(transcription).phonemes.map(key).join(''));
  return keys.every(value => value === keys[0]);
}

function parse(transcription: string): {open: string; close: string; phonemes: string[]} {
  const match = /^\s*([/[]?)(.*?)([/\]]?)\s*$/su.exec(transcription);
  const body = match?.[2] ?? transcription;
  return {open: match?.[1] ?? '', close: match?.[3] ?? '', phonemes: phonemes(body)};
}

/** Symbols with their diacritics and tie bars, then two-symbol units joined. */
export function phonemes(body: string): string[] {
  const symbols: string[] = [];
  for (const character of body) {
    const last = symbols.length - 1;
    const attaches = /\p{M}/u.test(character) || MODIFIERS.test(character);
    if (last >= 0 && (attaches || /[͜͡]$/u.test(symbols[last]))) symbols[last] += character;
    else symbols.push(character);
  }
  const units: string[] = [];
  for (let index = 0; index < symbols.length; index++) {
    const pair = symbols[index] + (symbols[index + 1] ?? '');
    const glide = symbols[index + 1]?.includes('̯') ?? false;
    if (index + 1 < symbols.length && (UNITS.has(pair) || glide)) {
      units.push(pair);
      index++;
    } else {
      units.push(symbols[index]);
    }
  }
  return units;
}

function key(phoneme: string): string {
  return Array.from(phoneme).map(symbol => SAME_SOUND[symbol] ?? symbol).join('');
}

/** The positions in each list left out of their longest common subsequence. */
function unmatched(a: string[], b: string[]): [number[], number[]] {
  const lengths = Array.from({length: a.length + 1}, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const restA: number[] = [];
  const restB: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      restA.push(i++);
    } else {
      restB.push(j++);
    }
  }
  while (i < a.length) restA.push(i++);
  while (j < b.length) restB.push(j++);
  return [restA, restB];
}

/** Neighbouring phonemes in the same state print as one span. */
function merge(segments: IpaSegment[]): IpaSegment[] {
  return segments.reduce<IpaSegment[]>((merged, segment) => {
    const last = merged[merged.length - 1];
    if (last?.differs === segment.differs) last.text += segment.text;
    else merged.push({...segment});
    return merged;
  }, []);
}
