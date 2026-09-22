import {Injectable} from '@angular/core';
import {ReaderPosition, ReaderPositionAnchor} from './reader-position.model';

/** The place within the current page; the reader adds which chapter page and rendering it is in. */
export type CapturedPlace = Omit<ReaderPosition, 'chapter' | 'presentation'>;
/** What restoring a place needs: the scroll geometry and the anchor, whichever record carries them. */
export type RestorablePlace = Pick<ReaderPosition, 'scrollTop' | 'scrollHeight' | 'clientWidth' | 'percentage' | 'anchor'>;

export interface ReaderChapter {
  title: string;
  offsetTop: number;
  elementId: string;
  index: number;
}

export interface ReaderScrollState {
  percentage: number;
  isAtTop: boolean;
  isAtBottom: boolean;
}

/** Owns browser-DOM operations for the reader so the component remains an orchestrator. */
@Injectable()
export class ReaderDomService {
  private readonly anchorSelector = 'h1, h2, h3, h4, h5, h6, p, pre, blockquote, li, div.poem';

  decode(buffer: ArrayBuffer): string {
    try {
      return new TextDecoder('utf-8', {fatal: true}).decode(buffer);
    } catch {
      return new TextDecoder('windows-1252').decode(buffer);
    }
  }

  getScrollState(element: HTMLElement): ReaderScrollState {
    const {scrollTop, scrollHeight, clientHeight} = element;
    const threshold = 2;

    if (scrollHeight <= clientHeight) {
      return {
        percentage: scrollTop <= threshold ? 0 : 100,
        isAtTop: true,
        isAtBottom: true,
      };
    }

    return {
      percentage: Math.max(0, Math.min(100, Math.round(scrollTop / (scrollHeight - clientHeight) * 100))),
      isAtTop: scrollTop <= threshold,
      isAtBottom: scrollTop >= scrollHeight - clientHeight - threshold,
    };
  }

  scrollTopForPercentage(element: HTMLElement, percentage: number): number | null {
    if (element.scrollHeight <= element.clientHeight || element.scrollHeight <= 0 || element.clientHeight <= 0) {
      return null;
    }

    return Math.round(percentage / 100 * (element.scrollHeight - element.clientHeight));
  }

  clampScrollTop(element: HTMLElement, value: number): number {
    return Math.max(0, Math.min(value, Math.max(0, element.scrollHeight - element.clientHeight)));
  }

  capturePosition(wrapper: HTMLElement, content: HTMLElement): CapturedPlace {
    const maxScrollTop = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight);
    const scrollTop = this.clampScrollTop(wrapper, wrapper.scrollTop);

    return {
      version: 2,
      scrollTop: Math.round(scrollTop),
      scrollHeight: wrapper.scrollHeight,
      clientWidth: wrapper.clientWidth,
      percentage: maxScrollTop === 0 ? 0 : scrollTop / maxScrollTop * 100,
      anchor: this.captureAnchor(wrapper, content),
    };
  }

  scrollTopForPosition(wrapper: HTMLElement, content: HTMLElement, position: RestorablePlace): number {
    if (position.scrollHeight === wrapper.scrollHeight && position.clientWidth === wrapper.clientWidth) {
      return this.clampScrollTop(wrapper, position.scrollTop);
    }

    const anchor = position.anchor ? this.resolveAnchor(content, position.anchor) : null;
    if (anchor) {
      const wrapperRect = wrapper.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const anchorTopInScrollArea = wrapper.scrollTop + anchorRect.top - wrapperRect.top;
      return this.clampScrollTop(wrapper, anchorTopInScrollArea + position.anchor!.offset);
    }

    const maxScrollTop = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight);
    return this.clampScrollTop(wrapper, position.percentage / 100 * maxScrollTop);
  }

  private captureAnchor(wrapper: HTMLElement, content: HTMLElement): ReaderPositionAnchor | null {
    const wrapperRect = wrapper.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const x = Math.max(wrapperRect.left + 1, Math.min(wrapperRect.right - 1, contentRect.left + contentRect.width / 2));
    let anchor: HTMLElement | null = null;

    for (const offset of [1, 8, 16, 24, 32, 48, 64]) {
      const y = Math.min(wrapperRect.bottom - 1, wrapperRect.top + offset);
      const hitTest = document.elementFromPoint?.(x, y);
      const candidate = hitTest instanceof Element
        ? hitTest.closest<HTMLElement>(this.anchorSelector)
        : null;
      if (candidate && content.contains(candidate)) {
        anchor = candidate;
        break;
      }
    }

    anchor ??= Array.from(content.querySelectorAll<HTMLElement>(this.anchorSelector))
      .find(element => element.getBoundingClientRect().bottom > wrapperRect.top) ?? null;
    if (!anchor) return null;

    const path = this.pathFromContent(content, anchor);
    if (!path) return null;

    return {
      path,
      offset: wrapperRect.top - anchor.getBoundingClientRect().top,
    };
  }

  private pathFromContent(content: HTMLElement, element: HTMLElement): number[] | null {
    const path: number[] = [];
    let current: Element | null = element;

    while (current && current !== content) {
      const parent: Element | null = current.parentElement;
      if (!parent) return null;
      const index = Array.prototype.indexOf.call(parent.children, current);
      if (index < 0) return null;
      path.unshift(index);
      current = parent;
    }

    return current === content ? path : null;
  }

  private resolveAnchor(content: HTMLElement, anchor: ReaderPositionAnchor): HTMLElement | null {
    let current: Element = content;
    for (const index of anchor.path) {
      const child = current.children.item(index);
      if (!child) return null;
      current = child;
    }
    return current instanceof HTMLElement ? current : null;
  }

  /**
   * The elements that answer for the alignment unit under a point in the text (design L): every
   * element of the sentence group the target is in, or the paragraph pair's runs when
   * the target is outside a confident sentence group.
   */
  unitAt(content: HTMLElement, target: EventTarget | null): HTMLElement[] {
    if (!(target instanceof Element) || !content.contains(target)) return [];
    const grouped = target.closest<HTMLElement>('[data-alignment]');
    const key = grouped?.dataset['alignment'];
    if (key && /^\d+-\d+-\d+$/.test(key)) {
      return Array.from(content.querySelectorAll<HTMLElement>(`[data-alignment="${key}"]`));
    }
    const paired = target.closest<HTMLElement>('[data-pair]');
    const pair = paired?.dataset['pair'];
    if (!pair || !/^\d+$/.test(pair)) return [];
    return Array.from(content.querySelectorAll<HTMLElement>(`[data-pair="${pair}"]`))
      .filter(element => !element.classList.contains('companion-source'));
  }

  /** Marks one unit and no other: the hover tint or the selection, by class. */
  mark(content: HTMLElement, unit: HTMLElement[], className: string): void {
    content.querySelectorAll(`.${className}`).forEach(element => {
      if (!unit.includes(element as HTMLElement)) element.classList.remove(className);
    });
    unit.forEach(element => element.classList.add(className));
  }

  /** The one open companion block in on-demand mode (L3); absent when nothing is open. */
  openCompanionBlock(content: HTMLElement): HTMLElement | null {
    return content.querySelector<HTMLElement>('.companion-block');
  }

  closeCompanionBlock(content: HTMLElement): void {
    this.openCompanionBlock(content)?.remove();
  }

  /**
   * Opens the unit's companion right where it ends (L3): the paragraph splits after the last
   * sentence of the group and the group's companion sentences open in a block there, the rest of
   * the paragraph continuing under it. Where the paragraph is the unit, the whole companion
   * paragraph opens after it. Returns whether a block opened.
   */
  openCompanionFor(content: HTMLElement, unit: HTMLElement[], animate: boolean): boolean {
    this.closeCompanionBlock(content);
    const primary = unit.filter(element => !element.closest('.companion-source'));
    const anchor = primary[primary.length - 1];
    const block = anchor?.closest<HTMLElement>('p, h1, h2, h3, h4, h5, h6, blockquote, li, div.poem');
    const source = block?.querySelector<HTMLElement>('.companion-source .segment');
    if (!anchor || !block || !source) return false;

    const key = anchor.dataset['alignment'];
    const sentences = key
      ? Array.from(source.querySelectorAll<HTMLElement>(`[data-alignment="${key}"]`))
      : [source];
    if (sentences.length === 0) return false;

    const companion = document.createElement('span');
    companion.className = 'companion-block';
    if (key) companion.dataset['alignment'] = key;
    const text = document.createElement('span');
    text.className = 'companion-block__text';
    if (source.lang) text.lang = source.lang;
    text.textContent = sentences.map(sentence => sentence.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter(Boolean).join(' ');
    companion.appendChild(text);
    anchor.after(companion);

    if (animate) requestAnimationFrame(() => companion.classList.add('is-open'));
    else companion.classList.add('is-open');
    return true;
  }

  measureChapters(content: HTMLElement, targetLanguage: string | null): ReaderChapter[] {
    // Chapter identity is the heading anchor, not its presentation class.
    return Array.from(content.querySelectorAll<HTMLElement>('h2[id]'))
      .map((heading, index): ReaderChapter | null => {
        if (!heading.id) return null;
        const titleSpan = targetLanguage
          ? heading.querySelector<HTMLElement>(`span.segment[lang="${CSS.escape(targetLanguage)}"]`)
          : null;
        const rawTitle = [titleSpan?.innerText, heading.innerText]
          .find(candidate => candidate?.trim()) ?? $localize`Chapter ${index + 1}:number:`;
        const title = rawTitle
          .replace(/\s+/g, ' ')
          .trim();

        return {title, offsetTop: heading.offsetTop, elementId: heading.id, index};
      })
      .filter((chapter): chapter is ReaderChapter => chapter !== null)
      .sort((a, b) => a.offsetTop - b.offsetTop);
  }

  findChapter(content: HTMLElement, elementId: string): HTMLElement | null {
    return Array.from(content.querySelectorAll<HTMLElement>('h2[id]')).find(element => element.id === elementId) ?? null;
  }
}
