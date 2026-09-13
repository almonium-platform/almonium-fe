/**
 * The shelf palette: the eight hues of the language colour picker (D4), at one fixed lightness and
 * chroma so no spine or cover can out-shout plum. A book keeps its hue forever, which is what makes a
 * shelf work as memory: the same id hashes to the same hue, and a cover's dominant colour is snapped to
 * the nearest of the eight rather than reproduced.
 */
export const BOOK_HUES = [15, 40, 85, 140, 195, 240, 285, 325] as const;

export type BookHue = (typeof BOOK_HUES)[number];

/** FNV-1a over the id, then one of the eight hues. Deterministic across sessions and devices. */
export function hashedBookHue(id: string): BookHue {
  let result = 2166136261;
  for (const character of id) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return BOOK_HUES[(result >>> 0) % BOOK_HUES.length];
}

/** Same hash, spread over a second dimension so thickness does not follow hue. */
export function hashedSpineWidth(id: string): number {
  let result = 2166136261;
  for (const character of id) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return 34 + ((result >>> 3) % 33);
}

/** The nearest of the eight hues to any hue angle, on the shortest arc. */
export function snapBookHue(hue: number): BookHue {
  const normalised = ((hue % 360) + 360) % 360;
  let best: BookHue = BOOK_HUES[0];
  let bestDistance = Infinity;
  for (const candidate of BOOK_HUES) {
    const raw = Math.abs(candidate - normalised);
    const distance = Math.min(raw, 360 - raw);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** The colour a spine or typographic cover is painted in, for a hue from the palette. */
export function bookColor(hue: number): string {
  return `oklch(0.6 0.09 ${hue})`;
}

/** The pale tint of the same hue, for chips and grounds. */
export function bookTint(hue: number): string {
  return `oklch(0.93 0.04 ${hue})`;
}

const dominantHueCache = new Map<string, Promise<BookHue | null>>();

/**
 * Samples a cover image's dominant hue and snaps it to the palette. Resolves to null when the image
 * cannot be read (cross-origin without CORS headers, a broken URL, or no canvas), in which case the
 * caller falls back to the hashed hue. Cached per URL for the page's lifetime.
 */
export function dominantBookHue(url: string): Promise<BookHue | null> {
  const cached = dominantHueCache.get(url);
  if (cached) return cached;
  const pending = sampleDominantHue(url).catch(() => null);
  dominantHueCache.set(url, pending);
  return pending;
}

function sampleDominantHue(url: string): Promise<BookHue | null> {
  return new Promise(resolve => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, size, size);
        const {data} = context.getImageData(0, 0, size, size);
        resolve(dominantHueOfPixels(data));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** Weighs each saturated pixel by its saturation, so a mostly-cream cover with a red title reads red. */
export function dominantHueOfPixels(data: Uint8ClampedArray): BookHue | null {
  const bins = new Map<BookHue, number>();
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    if (alpha < 0.5) continue;
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    if (delta < 0.08) continue;
    let hue: number;
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
    const snapped = snapBookHue(hue);
    bins.set(snapped, (bins.get(snapped) ?? 0) + delta);
  }
  let best: BookHue | null = null;
  let bestWeight = 0;
  for (const [hue, weight] of bins) {
    if (weight > bestWeight) {
      bestWeight = weight;
      best = hue;
    }
  }
  return best;
}
