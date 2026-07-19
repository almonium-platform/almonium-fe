import {Pipe, PipeTransform} from '@angular/core';
import {ParallelMode} from '../parallel-mode.type';
import {sanitizeBookHtml} from './book-html-sanitizer';

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
  transform(value: string | null, options: ParallelFormatOptions | null): string {
    const sanitizedValue = sanitizeBookHtml(value ?? '');
    if (!value || !options?.mode || !options.targetLang || !options.fluentLang) {
      return sanitizedValue;
    }
    const {mode, targetLang, fluentLang} = options;

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedValue, 'text/html');

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
            const targetSegment = this.findSegment(segPair, targetLang);
            const fluentSegment = this.findSegment(segPair, fluentLang);

            if (targetSegment && fluentSegment) {
              const colorClass = `sbs-color-${(segmentIndex % SIDE_BY_SIDE_COLORS.length) + 1}`;
              segmentIndex++;

              // Create new, clean segments
              const newTarget = document.createElement('span');
              newTarget.className = `sbs-segment ${colorClass}`;
              newTarget.append(...Array.from(targetSegment.childNodes, node => node.cloneNode(true)));

              const newFluent = document.createElement('span');
              newFluent.className = `sbs-segment ${colorClass}`;
              newFluent.append(...Array.from(fluentSegment.childNodes, node => node.cloneNode(true)));

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
        const mainColumn = doc.createElement('div');
        mainColumn.className = 'sbs-column sbs-column-main';
        mainColumn.appendChild(mainColumnBlock);
        const secondaryColumn = doc.createElement('div');
        secondaryColumn.className = 'sbs-column sbs-column-secondary';
        secondaryColumn.appendChild(secondaryColumnBlock);
        container.append(mainColumn, secondaryColumn);
        block.parentNode?.replaceChild(container, block);
      });
    }

    // --- INLINE AND OVERLAY MODES ---
    if (mode === 'inline' || mode === 'overlay') {
      const segPairs = doc.querySelectorAll('span.seg-pair');
      segPairs.forEach(pair => {
        const targetSegment = this.findSegment(pair, targetLang);
        const fluentSegment = this.findSegment(pair, fluentLang);
        if (mode === 'overlay' && targetSegment) {
          targetSegment.setAttribute('role', 'button');
          targetSegment.setAttribute('tabindex', '0');
        }
        if (fluentSegment) {
          // Create a wrapper and move the fluent segment inside it
          const wrapper = doc.createElement('span');
          wrapper.className = mode === 'inline' ? 'fluent-segment-inline' : 'fluent-segment-overlay';
          fluentSegment.parentNode?.insertBefore(wrapper, fluentSegment);
          wrapper.appendChild(fluentSegment);
        }
      });
    }

    return sanitizeBookHtml(doc.body.innerHTML);
  }

  private findSegment(parent: Element, language: string): HTMLElement | undefined {
    return Array.from(parent.querySelectorAll<HTMLElement>('span.segment'))
      .find(segment => segment.lang === language);
  }
}
