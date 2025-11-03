import {Pipe, PipeTransform} from '@angular/core';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {ParallelMode} from '../parallel-mode.type';

const SIDE_BY_SIDE_COLORS = ['#f0f8ff', '#fff0f5', '#f5fffa', '#fafad2'];

export interface ParallelFormatOptions {
  mode: ParallelMode | null;
  targetLang: string | null;
  fluentLang: string | null;
}

@Pipe({
  name: 'parallelFormat',
  standalone: true,
})
export class ParallelFormatPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {
  }

  transform(value: string | null, options: ParallelFormatOptions | null): SafeHtml | null {
    if (!value || !options || !options.mode || !options.targetLang || !options.fluentLang) {
      return this.sanitizer.bypassSecurityTrustHtml(value || '');
    }
    const {mode, targetLang, fluentLang} = options;

    // Step 1: Use the browser's native parser to create a real DOM tree. This is robust.
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, 'text/html');

    // --- SIDE-BY-SIDE MODE ---
    if (mode === 'side') {
      const blocks = doc.querySelectorAll('p, h2, div.poem'); // Find all structural blocks
      blocks.forEach(block => {
        const mainColumnBlock = block.cloneNode() as HTMLElement;
        const secondaryColumnBlock = block.cloneNode() as HTMLElement;
        let segmentIndex = 0;

        // Iterate through all child nodes (elements, text nodes, etc.)
        block.childNodes.forEach(node => {
          // If the node is a seg-pair, we process it
          if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('seg-pair')) {
            const segPair = node as HTMLElement;
            const targetSegment = segPair.querySelector(`span.segment[lang="${targetLang}"]`);
            const fluentSegment = segPair.querySelector(`span.segment[lang="${fluentLang}"]`);

            if (targetSegment && fluentSegment) {
              const colorClass = `sbs-color-${(segmentIndex % SIDE_BY_SIDE_COLORS.length) + 1}`;
              segmentIndex++;

              // Create new, clean segments
              const newTarget = document.createElement('span');
              newTarget.className = `sbs-segment ${colorClass}`;
              newTarget.innerHTML = targetSegment.innerHTML;

              const newFluent = document.createElement('span');
              newFluent.className = `sbs-segment ${colorClass}`;
              newFluent.innerHTML = fluentSegment.innerHTML;

              mainColumnBlock.appendChild(newTarget);
              secondaryColumnBlock.appendChild(newFluent);
            }
          } else {
            // If it's just text (like punctuation), clone it and add to both columns
            mainColumnBlock.appendChild(node.cloneNode());
            secondaryColumnBlock.appendChild(node.cloneNode());
          }
        });

        // Create the final container and replace the original block with it
        const container = doc.createElement('div');
        container.className = 'sbs-block-container';
        container.innerHTML = `
          <div class="sbs-column sbs-column-main">${mainColumnBlock.outerHTML}</div>
          <div class="sbs-column sbs-column-secondary">${secondaryColumnBlock.outerHTML}</div>
        `;
        block.parentNode?.replaceChild(container, block);
      });
    }

    // --- INLINE AND OVERLAY MODES ---
    if (mode === 'inline' || mode === 'overlay') {
      const segPairs = doc.querySelectorAll('span.seg-pair');
      segPairs.forEach(pair => {
        const fluentSegment = pair.querySelector(`span.segment[lang="${fluentLang}"]`);
        if (fluentSegment) {
          // Create a wrapper and move the fluent segment inside it
          const wrapper = doc.createElement('span');
          wrapper.className = mode === 'inline' ? 'fluent-segment-inline' : 'fluent-segment-overlay';
          fluentSegment.parentNode?.insertBefore(wrapper, fluentSegment);
          wrapper.appendChild(fluentSegment);
        }
      });
    }

    // Step 2: Serialize the modified DOM tree back to a string.
    return this.sanitizer.bypassSecurityTrustHtml(doc.body.innerHTML);
  }
}
