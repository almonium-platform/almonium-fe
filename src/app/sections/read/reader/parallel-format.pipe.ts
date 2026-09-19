import {Pipe, PipeTransform} from '@angular/core';
import {ParallelMode} from '../parallel-mode.type';
import {sanitizeBookHtml} from './book-html-sanitizer';

export interface ParallelFormatOptions {
  mode: ParallelMode | null;
  targetLang: string | null;
  fluentLang: string | null;
}

/** The blocks a paragraph pair can be: the companion follows them as a paragraph of its own in inline mode. */
const PARAGRAPH_BLOCKS = new Set(['P', 'BLOCKQUOTE']);

/**
 * Lays a companion edition into the chapter markup (design L). Nothing here paints: alignment stays
 * invisible until the reader hovers or selects a unit, which the reader itself marks in the DOM.
 *
 * - `side`: one CSS grid per chapter, a primary cell and a companion cell per block, so paragraph
 *   pairs stay level without any height sync. Each cell wraps its text in an inline run that shares a
 *   `data-pair` id with its counterpart, the unit where no sentence groups exist. Every sentence group
 *   also carries a `data-ink` from a three-ink cycle (L8), which the reader paints only while the
 *   reader has asked to see the pairs.
 * - `inline`: every sentence group is followed by its companion inside the same paragraph flow as a
 *   grey run; a paragraph with no groups is followed by its companion paragraph.
 * - `demand`: the companion segment stays in the DOM, hidden, so a click can open just the group's
 *   companion sentences under the paragraph.
 */
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
    const doc = new DOMParser().parseFromString(sanitizedValue, 'text/html');

    if (mode === 'side') this.layOutSideBySide(doc, targetLang, fluentLang);
    else if (mode === 'inline') this.interleave(doc, targetLang, fluentLang);
    else this.keepCompanionForDemand(doc, targetLang, fluentLang);

    return sanitizeBookHtml(doc.body.innerHTML);
  }

  // --- Side by side (L2) ---

  private layOutSideBySide(doc: Document, targetLang: string, fluentLang: string): void {
    const blocks = Array.from(doc.querySelectorAll<HTMLElement>('p, h2, h3, h4, blockquote, div.poem'))
      .filter(block => block.querySelector(':scope > .seg-pair'));
    let pairIndex = 0;
    const grids = new Set<HTMLElement>();

    blocks.forEach(block => {
      const primaryCell = block.cloneNode() as HTMLElement;
      const companionCell = block.cloneNode() as HTMLElement;
      primaryCell.classList.add('sbs-cell', 'sbs-cell--primary');
      companionCell.classList.add('sbs-cell', 'sbs-cell--companion');
      // The primary cell owns the chapter anchor; duplicate ids break navigation.
      companionCell.removeAttribute('id');

      block.childNodes.forEach(node => {
        if (node instanceof Element && node.classList.contains('seg-pair')) {
          const primary = this.findSegment(node, targetLang, 'primary');
          const companion = this.findSegment(node, fluentLang, 'secondary');
          if (!primary || !companion) return;
          const id = `${pairIndex++}`;
          primaryCell.appendChild(this.run(doc, primary, 'sbs-segment', id));
          companionCell.appendChild(this.run(doc, companion, 'sbs-segment', id));
        } else {
          // Plain text between pairs, such as punctuation, belongs to both columns.
          primaryCell.appendChild(node.cloneNode(true));
          companionCell.appendChild(node.cloneNode(true));
        }
      });

      const parent = block.parentElement;
      if (!parent) return;
      grids.add(parent);
      parent.replaceChild(companionCell, block);
      parent.insertBefore(primaryCell, companionCell);
    });

    // Every chapter is a grid, even one without pairs, so headings and rules span both columns.
    doc.querySelectorAll<HTMLElement>('section.chapter').forEach(section => grids.add(section));
    if (grids.size === 0 || grids.has(doc.body)) {
      grids.delete(doc.body);
      const grid = doc.createElement('div');
      grid.append(...Array.from(doc.body.childNodes));
      doc.body.appendChild(grid);
      grids.add(grid);
    }
    grids.forEach(grid => {
      grid.classList.add('sbs-grid');
      Array.from(grid.children).forEach(child => {
        if (!child.classList.contains('sbs-cell')) child.classList.add('sbs-span');
      });
    });
    this.inkSentenceGroups(doc);
  }

  /**
   * The pairs' inks (L8): a three-ink cycle keyed on the group's order in the primary column, so a
   * swapped order or a 1→2 split reads without hovering; both halves of a pair share the key.
   * Paragraph-only alignments get none, since a whole underlined paragraph says nothing.
   */
  private inkSentenceGroups(doc: Document): void {
    const inkOf = new Map<string, number>();
    doc.querySelectorAll<HTMLElement>('.sbs-cell--primary [data-alignment]').forEach(sentence => {
      const key = sentence.dataset['alignment'];
      if (key && !inkOf.has(key)) inkOf.set(key, inkOf.size % 3);
    });
    doc.querySelectorAll<HTMLElement>('.sbs-cell [data-alignment]').forEach(sentence => {
      const ink = inkOf.get(sentence.dataset['alignment'] ?? '');
      if (ink !== undefined) sentence.dataset['ink'] = `${ink}`;
    });
  }

  /** The segment's content as one inline run that carries the pair id. */
  private run(doc: Document, segment: HTMLElement, className: string, pairId: string): HTMLElement {
    const run = doc.createElement('span');
    run.className = className;
    if (segment.lang) run.lang = segment.lang;
    run.dataset['pair'] = pairId;
    run.append(...Array.from(segment.childNodes, node => node.cloneNode(true)));
    return run;
  }

  // --- Inline (L4) ---

  private interleave(doc: Document, targetLang: string, fluentLang: string): void {
    let pairIndex = 0;
    doc.querySelectorAll<HTMLElement>('span.seg-pair').forEach(pair => {
      const primary = this.findSegment(pair, targetLang, 'primary');
      const companion = this.findSegment(pair, fluentLang, 'secondary');
      if (!primary || !companion) return;

      if (!primary.querySelector('[data-alignment]')) {
        this.followWithCompanion(doc, pair, primary, companion, `${pairIndex++}`);
        return;
      }
      this.interleaveGroups(doc, primary, companion);
      companion.remove();
    });
  }

  /** No sentence groups: the companion paragraph follows the paragraph, or sits inline after a heading. */
  private followWithCompanion(doc: Document, pair: HTMLElement, primary: HTMLElement, companion: HTMLElement, pairId: string): void {
    primary.dataset['pair'] = pairId;
    const block = pair.parentElement;
    if (block && PARAGRAPH_BLOCKS.has(block.tagName) && block.parentElement) {
      const paragraph = doc.createElement('p');
      paragraph.className = 'companion-paragraph';
      if (companion.lang) paragraph.lang = companion.lang;
      paragraph.dataset['pair'] = pairId;
      paragraph.append(...Array.from(companion.childNodes));
      companion.remove();
      block.parentElement.insertBefore(paragraph, block.nextSibling);
      return;
    }
    const run = this.run(doc, companion, 'companion-run', pairId);
    companion.replaceWith(run);
  }

  /** Each sentence group is followed by its companion sentences as a run in the same flow. */
  private interleaveGroups(doc: Document, primary: HTMLElement, companion: HTMLElement): void {
    const companionNodes = Array.from(companion.childNodes);
    const keyOf = (node: Node): string | null => node instanceof HTMLElement ? node.dataset['alignment'] ?? null : null;
    const claimed = new Set<Node>();

    // A group's run: its companion sentences, plus the plain text that follows them up to the next group.
    const runFor = (key: string): HTMLElement | null => {
      const indices = companionNodes.flatMap((node, index) => keyOf(node) === key ? [index] : []);
      if (indices.length === 0) return null;
      let end = indices[indices.length - 1] + 1;
      while (end < companionNodes.length && keyOf(companionNodes[end]) === null) end++;
      const nodes = companionNodes.slice(indices[0], end).filter(node => {
        const nodeKey = keyOf(node);
        if (nodeKey === key) return true;
        if (nodeKey !== null || claimed.has(node)) return false;
        claimed.add(node);
        return true;
      });
      return this.companionRun(doc, companion.lang, nodes, key);
    };
    const firstGroup = companionNodes.findIndex(node => keyOf(node) !== null);
    const lead = firstGroup > 0
      ? this.companionRun(doc, companion.lang, companionNodes.slice(0, firstGroup), null)
      : null;

    const primaryNodes = Array.from(primary.childNodes);
    const lastIndexOfKey = new Map<string, number>();
    primaryNodes.forEach((node, index) => { const key = keyOf(node); if (key) lastIndexOfKey.set(key, index); });
    const firstPrimaryGroup = primaryNodes.findIndex(node => keyOf(node) !== null);

    primary.replaceChildren();
    primaryNodes.forEach((node, index) => {
      if (index === firstPrimaryGroup && lead) primary.append(lead, ' ');
      primary.appendChild(node);
      const key = keyOf(node);
      if (key && lastIndexOfKey.get(key) === index) {
        const run = runFor(key);
        if (run) primary.append(' ', run);
      }
    });
  }

  /** A grey companion run: the sentences unwrapped to text, trimmed at both ends. */
  private companionRun(doc: Document, lang: string, nodes: Node[], key: string | null): HTMLElement | null {
    const run = doc.createElement('span');
    run.className = 'companion-run';
    if (lang) run.lang = lang;
    if (key) {
      // A run answers for its group like a sentence does: hover or focus lights both halves.
      run.dataset['alignment'] = key;
      run.setAttribute('role', 'button');
      run.setAttribute('tabindex', '0');
    }
    nodes.forEach(node => {
      if (node instanceof HTMLElement && node.dataset['alignment']) {
        run.append(...Array.from(node.childNodes, child => child.cloneNode(true)));
      } else {
        run.appendChild(node.cloneNode(true));
      }
    });
    this.trim(run);
    return run.textContent?.trim() ? run : null;
  }

  private trim(run: HTMLElement): void {
    const first = run.firstChild;
    if (first?.nodeType === Node.TEXT_NODE) first.textContent = first.textContent?.replace(/^\s+/, '') ?? '';
    const last = run.lastChild;
    if (last?.nodeType === Node.TEXT_NODE) last.textContent = last.textContent?.replace(/\s+$/, '') ?? '';
  }

  // --- On demand (L3) ---

  private keepCompanionForDemand(doc: Document, targetLang: string, fluentLang: string): void {
    let pairIndex = 0;
    doc.querySelectorAll<HTMLElement>('span.seg-pair').forEach(pair => {
      const primary = this.findSegment(pair, targetLang, 'primary');
      const companion = this.findSegment(pair, fluentLang, 'secondary');
      if (!primary || !companion) return;
      const id = `${pairIndex++}`;
      primary.dataset['pair'] = id;
      // A paragraph without sentence groups is the unit: it opens as a whole.
      if (!primary.querySelector('[data-alignment]')) {
        primary.setAttribute('role', 'button');
        primary.setAttribute('tabindex', '0');
      }
      const source = doc.createElement('span');
      source.className = 'companion-source';
      source.dataset['pair'] = id;
      companion.parentNode?.insertBefore(source, companion);
      source.appendChild(companion);
    });
  }

  private findSegment(parent: Element, language: string, side: string): HTMLElement | undefined {
    const segments = Array.from(parent.querySelectorAll<HTMLElement>(':scope > span.segment'));
    return segments.find(segment => segment.dataset['side'] === side)
      ?? segments.find(segment => segment.lang === language);
  }
}
