/**
 * How the reader's page looks (design G25–G27): five choices, the same for every book. Size, line spacing and
 * width are steps rather than free values, so a saved choice means the same thing on a phone and a desktop.
 */
export type ReaderTheme = 'auto' | 'paper' | 'sepia' | 'night';
export type ReaderFont = 'serif' | 'sans' | 'atkinson';

export interface ReaderAppearance {
  /** Auto follows the app theme; the others repaint the reader only. */
  theme: ReaderTheme;
  font: ReaderFont;
  /** Index into READER_SIZES. */
  size: number;
  /** Index into READER_LINE_SPACINGS. */
  lineSpacing: number;
  /** Index into READER_WIDTHS. Kept on the account but only applied where there is room for a choice. */
  width: number;
}

export const READER_THEMES: readonly ReaderTheme[] = ['auto', 'paper', 'sepia', 'night'];
export const READER_FONTS: readonly ReaderFont[] = ['serif', 'sans', 'atkinson'];
/** The text size in px on a desktop; a phone runs 2px under the same step. */
export const READER_SIZES: readonly number[] = [15, 17, 19, 21, 23, 26, 29];
export const READER_LINE_SPACINGS: readonly number[] = [1.45, 1.65, 1.9];
/** The text column's max-width in px. */
export const READER_WIDTHS: readonly number[] = [560, 680, 800];

export const DEFAULT_READER_APPEARANCE: ReaderAppearance = {
  theme: 'auto',
  font: 'serif',
  size: 2,
  lineSpacing: 1,
  width: 1,
};

export const READER_FONT_FAMILIES: Record<ReaderFont, string> = {
  serif: `'Literata', serif`,
  sans: `'IBM Plex Sans', sans-serif`,
  atkinson: `'Atkinson Hyperlegible', 'IBM Plex Sans', sans-serif`,
};

/**
 * Reads an appearance from anywhere it may have been kept (the account's preferences, this device's storage),
 * taking each field that is valid and the default for each that is not: a value saved by a newer or older
 * build never breaks the reader, it just falls back.
 */
export function parseReaderAppearance(value: unknown): ReaderAppearance {
  const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const step = (candidate: unknown, steps: readonly number[], fallback: number): number =>
    typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 0 && candidate < steps.length
      ? candidate
      : fallback;
  return {
    theme: READER_THEMES.includes(raw['theme'] as ReaderTheme) ? raw['theme'] as ReaderTheme : DEFAULT_READER_APPEARANCE.theme,
    font: READER_FONTS.includes(raw['font'] as ReaderFont) ? raw['font'] as ReaderFont : DEFAULT_READER_APPEARANCE.font,
    size: step(raw['size'], READER_SIZES, DEFAULT_READER_APPEARANCE.size),
    lineSpacing: step(raw['lineSpacing'], READER_LINE_SPACINGS, DEFAULT_READER_APPEARANCE.lineSpacing),
    width: step(raw['width'], READER_WIDTHS, DEFAULT_READER_APPEARANCE.width),
  };
}
