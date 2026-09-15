/**
 * 03: the disc under a language code.
 *
 * One language, one colour. The fill is the language's own stored colour - the same `langColors`
 * value that sits behind the navbar code badge and the rhythm band - and nothing here defines a
 * palette of its own; a second set of hues for chat is two colours for German that can drift
 * apart. The disc only normalises the stored colour for legibility: its hue is kept, chroma is
 * held at 0.10, and lightness is clamped into the band the theme allows. Where cream letters
 * still fall short of 4.5:1 the disc darkens in steps of 0.03 L until they pass, rather than
 * switching the letters to ink.
 */

const CHROMA = 0.1;
const LIGHT_BAND = {min: 0.4, max: 0.48};
const DARK_LIGHTNESS = 0.55;
const MIN_CONTRAST = 4.5;
const DARKEN_STEP = 0.03;

/** The letters the disc has to carry, matching `--channel-crest-ink`. */
const CREST_INK = '#F1EAEF';

/** The fallback the navbar and the rhythm band already use for a language with no stored colour. */
const DEFAULT_CREST = '#7A6BB8';

type Rgb = [number, number, number];

export function crestFill(storedColor: string | undefined, isDark: boolean): string {
  const stored = parseHex(storedColor) ?? parseHex(DEFAULT_CREST)!;
  const {lightness: storedLightness, hue} = toOklch(stored);

  let lightness = isDark ? DARK_LIGHTNESS : clamp(storedLightness, LIGHT_BAND.min, LIGHT_BAND.max);
  while (lightness > DARKEN_STEP && contrast(inkLuminance, luminanceOf(lightness, hue)) < MIN_CONTRAST) {
    lightness -= DARKEN_STEP;
  }

  return `oklch(${round(lightness, 3)} ${CHROMA} ${round(hue, 1)})`;
}

function luminanceOf(lightness: number, hue: number): number {
  return relativeLuminance(oklchToRgb(lightness, CHROMA, hue));
}

function parseHex(value: string | undefined): Rgb | null {
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value?.trim() ?? '')?.[1];
  if (!hex) return null;

  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Rgb;
}

/*
 * Oklab, after Bjorn Ottosson. Only lightness and hue are read back out: chroma is the design's
 * constant, so a stored colour contributes where it sits on the wheel and how dark it is, and
 * nothing else.
 */
function toOklch(rgb: Rgb): {lightness: number; hue: number} {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return {lightness, hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360};
}

function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toSrgb) as Rgb;
}

function contrast(one: number, other: number): number {
  const [lighter, darker] = one > other ? [one, other] : [other, one];
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function toSrgb(channel: number): number {
  const encoded = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
  return clamp(encoded, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

const inkLuminance = relativeLuminance(parseHex(CREST_INK)!);
