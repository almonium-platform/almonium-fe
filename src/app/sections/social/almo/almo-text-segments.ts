/**
 * 11: the two marks a bubble in Almo's channel can carry, and nothing else.
 *
 * A dotted underline says the word is in this learner's queue for this language - provenance, not
 * pedagogy, and it lands on Almo's words and the learner's alike. Plum medium weight is the
 * confusion pair, both members, named in one plain bubble: no overlay, no red. The server names the
 * exact forms as they appear in the text; this only finds them and leaves everything else as it is.
 */
export type AlmoSegmentKind = 'plain' | 'word' | 'contrast';

export interface AlmoSegment {
  text: string;
  kind: AlmoSegmentKind;
}

export function segmentAlmoText(text: string, words: readonly string[], contrast: readonly string[]): AlmoSegment[] {
  const forms = [...new Set([...contrast, ...words].map(form => form.trim()).filter(Boolean))];
  if (!text || !forms.length) return text ? [{text, kind: 'plain'}] : [];

  const contrastForms = new Set(contrast.map(form => form.trim().toLowerCase()));
  // Longest first, so "sich vornehmen" wins over "vornehmen" where both are listed.
  const alternation = forms
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  // A form is a whole word or phrase: "dabei" must not light up inside "dabeisein".
  const matcher = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, 'giu');

  const segments: AlmoSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    if (start > cursor) segments.push({text: text.slice(cursor, start), kind: 'plain'});
    segments.push({
      text: match[0],
      kind: contrastForms.has(match[0].toLowerCase()) ? 'contrast' : 'word',
    });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) segments.push({text: text.slice(cursor), kind: 'plain'});
  return segments;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
