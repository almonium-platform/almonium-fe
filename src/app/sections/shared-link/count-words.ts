const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * A count spelled out for prose: "Twenty-four words in German". Numerals stay numerals wherever they label a control
 * ("Add 18 words"), so this is only for sentences. Past ninety-nine the numeral is the readable form anyway.
 */
export function numberInWords(count: number): string {
  if (!Number.isInteger(count) || count < 0 || count > 99) return String(count);
  if (count < 20) return ONES[count];
  const tens = TENS[Math.floor(count / 10)];
  const ones = count % 10;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "one word" / "twenty-four words", for sentences. */
export function wordsInProse(count: number): string {
  return `${numberInWords(count)} ${count === 1 ? 'word' : 'words'}`;
}

/** "1 word" / "18 words", for buttons and labels. */
export function wordsAsLabel(count: number): string {
  return `${count} ${count === 1 ? 'word' : 'words'}`;
}
