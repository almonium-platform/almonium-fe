import {Pipe, PipeTransform} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';

@Pipe({
  name: 'parallelFormat',
  standalone: true,
})
export class ParallelFormatPipe implements PipeTransform {

  // Regex to find {Eng|Ukr} blocks globally, handling potential variations
  // It captures content up to '|' and content after '|' until '}'
  // Allows nested braces within segments if needed, but focuses on top-level pairs
  private segmentRegex = /\{(.*?)\|(.*?)\}/g;

  transform(value: string | null | undefined, displayMode: 'eng-ukr' | 'eng' | 'ukr' = 'eng-ukr'): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    // Replace {Eng|Ukr} occurrences based on displayMode
    const transformedHtml = value.replace(
      this.segmentRegex,
      (match, engSegment, ukrSegment) => {
        // Trim potential whitespace just inside the pipe/braces captured by (.*?)
        const eng = engSegment?.trim() ?? '';
        const ukr = ukrSegment?.trim() ?? '';

        switch (displayMode) {
          case 'eng':
            return eng; // Return only English
          case 'ukr':
            return ukr; // Return only Ukrainian
          case 'eng-ukr':
          default:
            // Return format: English<span class="translation">(Ukrainian)</span>
            // Add a non-breaking space before the parenthesis if English doesn't end with space
            const space = eng.endsWith(' ') ? '' : ' ';
            // Wrap Ukrainian in a span for potential styling/hiding
            return `${eng}${space}<span class="translation">(${ukr})</span>`;
        }
      }
    );

    return transformedHtml;
  }
}

// --- IMPORTANT: You still need the SafeHtmlPipe ---
@Pipe({name: 'safeHtml', standalone: true})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {
  }

  transform(value: string | null | undefined): SafeHtml | null {
    if (value === null || value === undefined) return null;
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
