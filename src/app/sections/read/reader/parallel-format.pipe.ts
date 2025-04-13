import {Pipe, PipeTransform} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {DEFAULT_PARALLEL_MODE, ParallelMode} from '../parallel-mode.type'; // Adjust path

const SIDE_BY_SIDE_COLORS = ['#f0f8ff', '#fff0f5', '#f5fffa', '#fafad2']; // AliceBlue, LavenderBlush, MintCream, LemonChiffon

@Pipe({
  name: 'parallelFormat',
  standalone: true,
})
export class ParallelFormatPipe implements PipeTransform {

  // Regex to find segment pairs (validated)
  private segmentPairRegex = /<span\s+class="seg-pair"[^>]*>\s*<span\s+class="eng"[^>]*>.*?<\/span>\s*<span\s+class="ukr"[^>]*>.*?<\/span>\s*<\/span>/gis;

  // Regex to find the *inner* content within the ENG span
  private engContentRegex = /<span\s+class="eng"[^>]*>(.*?)<\/span>/is; // 's' flag for multiline

  // Regex to find the *inner* content within the UKR span
  private ukrContentRegex = /<span\s+class="ukr"[^>]*>(.*?)<\/span>/is; // 's' flag for multiline

  // Regex for the boolean hidden attribute
  private simpleHiddenAttributeRegex = /\s+hidden(?:=""|='')?/i;

  // Regex to find just the opening ukr tag
  private ukrTagRegex = /(<span\s+[^>]*class\s*=\s*"ukr"[^>]*>)/i;

  // Regex to target the eng span for adding 'clickable' class
  private engSpanClassRegex = /(<span\s+[^>]*class\s*=\s*"eng")/gi;

  // Regex to find top-level block elements (p, h2, div maybe with class poem)
  // Captures: $1=tagname (p, h2, div), $2=attributes, $3=inner content
  // Making inner content capture non-greedy and including potential line breaks
  private blockElementRegex = /<(p|h2|div)\b([^>]*)>(.*?)<\/\1>/gis;


  transform(value: string | null | undefined, mode: ParallelMode | null = DEFAULT_PARALLEL_MODE): string | null {
    if (value === null || value === undefined) return null;
    if (mode === null) return value; // Pass through if no parallel mode

    // --- Handle Side-by-Side Mode with LOGGING ---
    if (mode === 'side') {
      console.clear(); // Clear console for cleaner logs each time pipe runs

      let blockIndex = 0;
      return value.replace(this.blockElementRegex,
        (blockMatch, tagName, tagAttributes, originalBlockContent) => {
          blockIndex++;

          let engColumnContent = '';
          let ukrColumnContent = '';
          let segmentIndex = 0;
          let lastIndexProcessed = 0; // Track position in originalBlockContent

          // Iterate over seg-pairs within the originalBlockContent
          originalBlockContent.replace(this.segmentPairRegex,
            (pairMatch: string, offset: number) => { // Get offset of the match
              segmentIndex++;

              // Log any content BETWEEN the last segment and this one (or from start)
              const precedingContent = originalBlockContent.substring(lastIndexProcessed, offset);
              if (precedingContent.trim()) {
                // Decide how to handle preceding content - add to eng column?
                engColumnContent += precedingContent;
                ukrColumnContent += precedingContent; // Or just whitespace? Add spacer? For now, duplicate.
              }

              const engMatch = pairMatch.match(this.engContentRegex);
              const ukrMatch = pairMatch.match(this.ukrContentRegex);
              const engSegmentHtml = engMatch ? engMatch[1] : '[ENG CONTENT NOT FOUND]';
              const ukrSegmentHtml = ukrMatch ? ukrMatch[1] : '[UKR CONTENT NOT FOUND]';
              const colorClass = `sbs-color-${(segmentIndex % SIDE_BY_SIDE_COLORS.length) + 1}`;

              engColumnContent += `<span class="sbs-segment ${colorClass}">${engSegmentHtml}</span>`;
              ukrColumnContent += `<span class="sbs-segment ${colorClass}">${ukrSegmentHtml}</span>`;

              lastIndexProcessed = offset + pairMatch.length; // Update position
              return ''; // Return value not used
            }); // End segment iteration

          // Check for any trailing content after the last segment
          const trailingContent = originalBlockContent.substring(lastIndexProcessed);
          if (trailingContent.trim()) {
            // Decide how to handle trailing content - add to eng column?
            engColumnContent += trailingContent;
            ukrColumnContent += trailingContent; // Duplicate for now
          }

          // --- Determine the NEW inner content for the block ---
          let newInnerContent: string;
          if (segmentIndex > 0) {
            // If segments were found, create the column structure
            newInnerContent = `<!-- SBS Content Start (Block ${blockIndex}) -->
              <div class="sbs-block-container" data-block-index="${blockIndex}">
                <div class="sbs-column sbs-eng-column">${engColumnContent}</div>
                <div class="sbs-column sbs-ukr-column">${ukrColumnContent}</div>
              </div><!-- SBS Content End (Block ${blockIndex}) -->`;
          } else {
            // If NO segments were found, keep the original inner content of the block UNCHANGED.
            newInnerContent = originalBlockContent;
          }

          // --- Reconstruct the block ---
          return `<${tagName}${tagAttributes}>${newInnerContent}</${tagName}>`; // Replace the original blockMatch with this
        });

    } else { // --- Handle Inline and Overlay Modes ---
      console.log(`--- Pipe Running --- Mode: ${mode} (Inline/Overlay)`);
      // Process each segment pair found using the CORRECTED regex
      return value.replace(
        this.segmentPairRegex,
        (pairMatch) => {
          switch (mode) {
            case 'inline': { // REMOVE hidden attribute from UKR tag
              return pairMatch.replace(
                this.ukrTagRegex,
                (ukrTagMatch) => ukrTagMatch.replace(this.simpleHiddenAttributeRegex, '')
              );
            }

            case 'overlay': { // ADD hidden attribute if missing, add clickable to eng
              let modifiedPair = pairMatch.replace(this.engSpanClassRegex, '$1 clickable');
              modifiedPair = modifiedPair.replace(
                this.ukrTagRegex,
                (ukrTagMatch) => this.simpleHiddenAttributeRegex.test(ukrTagMatch) ? ukrTagMatch : ukrTagMatch.replace(/>$/, ' hidden>')
              );
              return modifiedPair;
            }

            default:
              console.warn(`ParallelFormatPipe: Unknown mode '${mode}' in non-side block, returning original pair.`);
              return pairMatch;
          }
        }
      );
    } // End else (inline/overlay modes)
  } // End transform
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
