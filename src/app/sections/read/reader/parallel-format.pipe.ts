import {Pipe, PipeTransform} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ParallelMode, DEFAULT_PARALLEL_MODE} from '../parallel-mode.type'; // Adjust path as needed

@Pipe({
  name: 'parallelFormat',
  standalone: true,
})
export class ParallelFormatPipe implements PipeTransform {

  // Regex to find each segment pair
  private segmentPairRegex = /<span class="seg-pair"[^>]*>.*?<\/span>/gis;

  // *** SIMPLIFIED Regex for the boolean hidden attribute ***
  // Matches ' hidden' OR ' hidden=""' OR ' hidden='''
  private simpleHiddenAttributeRegex = /\s+hidden(?:=""|='')?/i;

  // Regex to find just the opening ukr tag
  private ukrTagRegex = /(<span\s+[^>]*class\s*=\s*"ukr"[^>]*>)/i;

  // Regex to target the eng span for adding 'clickable' class (made slightly more robust)
  private engSpanClassRegex = /(<span\s+[^>]*class\s*=\s*"eng")/gi;

  transform(value: string | null | undefined, mode: ParallelMode = DEFAULT_PARALLEL_MODE): string | null {
    // console.log(`--- Pipe Running --- Mode: ${mode}`); // Uncomment for debugging
    if (value === null || value === undefined) {
      return null;
    }

    // Process each segment pair found
    return value.replace(
      this.segmentPairRegex,
      (pairMatch) => {
        switch (mode) {
          case 'inline':
          case 'side': { // 'inline' and 'side' modes: REMOVE hidden attribute
            const modifiedPair = pairMatch.replace(
              this.ukrTagRegex, // Find the opening ukr tag within the pair
              (ukrTagMatch) => {
                // Remove the simple hidden attribute FROM the matched tag string
                const cleanedTag = ukrTagMatch.replace(this.simpleHiddenAttributeRegex, '');
                // console.log(`Original UKR Tag (${mode}): ${ukrTagMatch}`); // Debug log
                // console.log(`Cleaned UKR Tag (${mode}) : ${cleanedTag}`);    // Debug log
                return cleanedTag;
              }
            );
            // Optional: Check if removal actually happened (for debugging)
            // if (modifiedPair === pairMatch && this.simpleHiddenAttributeRegex.test(pairMatch)) {
            //    console.warn(`${mode} mode: Failed to remove hidden attribute from pair: ${pairMatch.substring(0, 100)}...`);
            // }
            return modifiedPair;
          } // End 'inline' / 'side' case

          case 'overlay': { // 'overlay' mode: ADD hidden attribute if missing, add clickable to eng
            let modifiedPair = pairMatch;

            // Add 'clickable' class to the 'eng' span
            modifiedPair = modifiedPair.replace(this.engSpanClassRegex, '$1 clickable');

            // Ensure the 'ukr' span HAS the hidden attribute
            modifiedPair = modifiedPair.replace(
              this.ukrTagRegex, // Find the opening ukr tag
              (ukrTagMatch) => {
                // Check if ' hidden', ' hidden=""', or ' hidden=''' already exists
                if (!this.simpleHiddenAttributeRegex.test(ukrTagMatch)) {
                  // If NOT found, add ' hidden' just before the closing '>'
                  // console.log(`Overlay: Adding hidden to: ${ukrTagMatch}`); // Debug log
                  return ukrTagMatch.replace(/>$/, ' hidden>'); // Replace trailing > with ' hidden>'
                }
                // If it already exists, return the tag unchanged
                // console.log(`Overlay: Hidden already present in: ${ukrTagMatch}`); // Debug log
                return ukrTagMatch;
              }
            );
            return modifiedPair;
          } // End 'overlay' case

          default: // Should not happen with defined modes, but acts as fallback
            console.warn(`ParallelFormatPipe: Unknown mode '${mode}', returning original pair.`);
            return pairMatch;
        }
      }
    );
  }
}

// Keep SafeHtmlPipe
@Pipe({name: 'safeHtml', standalone: true})
export class SafeHtmlPipe
  implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {
  }

  transform(value: string | null | undefined): SafeHtml | null {
    if (value === null || value === undefined) return null;
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
