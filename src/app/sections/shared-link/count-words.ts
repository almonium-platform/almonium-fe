const ONES = [
  $localize`zero`, $localize`one`, $localize`two`, $localize`three`, $localize`four`, $localize`five`, $localize`six`,
  $localize`seven`, $localize`eight`, $localize`nine`, $localize`ten`, $localize`eleven`, $localize`twelve`,
  $localize`thirteen`, $localize`fourteen`, $localize`fifteen`, $localize`sixteen`, $localize`seventeen`,
  $localize`eighteen`, $localize`nineteen`,
];
const TENS = ['', '', $localize`twenty`, $localize`thirty`, $localize`forty`, $localize`fifty`, $localize`sixty`,
  $localize`seventy`, $localize`eighty`, $localize`ninety`];

/**
 * A count spelled out for prose: "Twenty-four words in German". Numerals stay numerals wherever they label a control
 * ("Add 18 words"), so this is only for sentences. Past ninety-nine the numeral is the readable form anyway.
 */
export function numberInWords(count: number): string {
  if (!Number.isInteger(count) || count < 0 || count > 99) return String(count);
  if (count < 20) return ONES[count];
  const tens = TENS[Math.floor(count / 10)];
  const ones = count % 10;
  return ones === 0 ? tens : $localize`${tens}:tens:-${ONES[ones]}:ones:`;
}

export function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "one word" / "twenty-four words", for sentences. */
export function wordsInProse(count: number): string {
  const number = numberInWords(count);
  return count === 1 ? $localize`${number}:count: word` : $localize`${number}:count: words`;
}

/** "1 word" / "18 words", for buttons and labels. */
export function wordsAsLabel(count: number): string {
  return count === 1 ? $localize`${count}:count: word` : $localize`${count}:count: words`;
}
