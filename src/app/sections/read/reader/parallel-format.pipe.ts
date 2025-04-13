import {Pipe, PipeTransform} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ParallelMode, DEFAULT_PARALLEL_MODE} from '../parallel-mode.type'; // Adjust path

// Define colors for cycling - add more if needed
const SIDE_BY_SIDE_COLORS = ['#f0f8ff', '#fff0f5', '#f5fffa', '#fafad2']; // AliceBlue, LavenderBlush, MintCream, LemonChiffon

@Pipe({
  name: 'parallelFormat',
  standalone: true,
})
export class ParallelFormatPipe implements PipeTransform {

  // Regex to find segment pairs (validated)
  private segmentPairRegex = /<span\s+class="seg-pair"[^>]*>\s*<span\s+class="eng"[^>]*>.*?<\/span>\s*<span\s+class="ukr"[^>]*>.*?<\/span>\s*<\/span>/gis;

  // Regex to find the content within the ENG span
  private engContentRegex = /<span\s+class="eng"[^>]*>(.*?)<\/span>/is; // Added 's' flag

  // Regex to find the content within the UKR span
  private ukrContentRegex = /<span\s+class="ukr"[^>]*>(.*?)<\/span>/is; // Added 's' flag

  // Regex for the boolean hidden attribute
  private simpleHiddenAttributeRegex = /\s+hidden(?:=""|='')?/i;

  // Regex to find just the opening ukr tag
  private ukrTagRegex = /(<span\s+[^>]*class\s*=\s*"ukr"[^>]*>)/i;

  // Regex to target the eng span for adding 'clickable' class
  private engSpanClassRegex = /(<span\s+[^>]*class\s*=\s*"eng")/gi;

  // *** Regex to find top-level block elements (p, h2, div.poem) ***
  // This captures the opening tag ($1), attributes ($2), content ($3), and tag name ($4)
  private blockElementRegex = /<(p|h2|div)\b([^>]*)>(.*?)<\/\1>/gis;


  // Accept ParallelMode OR null for the mode argument
  transform(value: string | null | undefined, mode: ParallelMode | null = DEFAULT_PARALLEL_MODE): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    // --- Handle NULL mode (no parallel view active) ---
    if (mode === null) {
      console.log("--- Pipe Running --- Mode: null (Passing through original HTML)");
      return value; // Return the original HTML unmodified
    }

    // --- Handle Side-by-Side Mode Separately ---
    if (mode === 'side') {
      console.log("--- Pipe Running --- Mode: side (Transforming HTML Structure)");
      let blockIndex = 0;

      // Process block by block
      return value.replace(this.blockElementRegex, (blockMatch, tagName, tagAttributes, blockContent) => {
        blockIndex++;
        console.log(`[Side Mode] Processing Block #${blockIndex} (<${tagName}>)`);

        let engColumnContent = '';
        let ukrColumnContent = '';
        let segmentIndex = 0;

        // Find segment pairs *within this block's content*
        blockContent.replace(this.segmentPairRegex, (pairMatch: string) => {
          const engMatch = pairMatch.match(this.engContentRegex);
          const ukrMatch = pairMatch.match(this.ukrContentRegex);
          const engSegmentHtml = engMatch ? engMatch[1] : ''; // Keep HTML tags within segment
          const ukrSegmentHtml = ukrMatch ? ukrMatch[1] : ''; // Keep HTML tags within segment

          // Assign color class based on segment index within the block
          const colorClass = `sbs-color-${(segmentIndex % SIDE_BY_SIDE_COLORS.length) + 1}`;

          // Wrap each segment for individual styling/coloring
          engColumnContent += `<span class="sbs-segment ${colorClass}">${engSegmentHtml}</span>`;
          ukrColumnContent += `<span class="sbs-segment ${colorClass}">${ukrSegmentHtml}</span>`;

          segmentIndex++;
          return ''; // Necessary for .replace() loop, we build manually
        });

        if (segmentIndex === 0) {
          // Handle blocks with no segments (e.g., maybe just <p><br></p>?)
          // If the original blockContent was just whitespace or empty, keep it simple.
          // If it had non-segment content, decide how to handle it.
          // For now, let's assume such blocks might not need the side-by-side structure
          // or we output empty columns. Let's try empty columns for alignment.
          console.log(`[Side Mode] Block #${blockIndex} has no segments. Content: ${blockContent.trim().substring(0, 50)}`);
          engColumnContent = blockContent.trim(); // Put original content in left? Or leave empty?
          ukrColumnContent = ''; // Empty right column
          // Or maybe return the original blockMatch if no segments? Needs testing.
          // Let's stick with column structure for potential alignment needs.
        }

        // Construct the new block HTML with side-by-side structure
        const newBlockHtml = `<${tagName}${tagAttributes}> <!-- Original Tag: ${tagName} -->
            <div class="sbs-block-container" data-block-index="${blockIndex}"> <!-- Container for grid & height sync -->
              <div class="sbs-column sbs-eng-column">${engColumnContent}</div>
              <div class="sbs-column sbs-ukr-column">${ukrColumnContent}</div>
            </div>
          </${tagName}>`;

        console.log(`[Side Mode] Finished Block #${blockIndex}. Segments found: ${segmentIndex}`);
        return newBlockHtml;
      });

    } else { // --- Handle Inline and Overlay Modes (existing logic) ---
      console.log(`--- Pipe Running --- Mode: ${mode}`);
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
