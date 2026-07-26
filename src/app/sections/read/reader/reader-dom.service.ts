import {Injectable} from '@angular/core';
import {ReaderPosition, ReaderPositionAnchor} from './reader-position.model';

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

  capturePosition(wrapper: HTMLElement, content: HTMLElement): ReaderPosition {
    const maxScrollTop = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight);
    const scrollTop = this.clampScrollTop(wrapper, wrapper.scrollTop);

    return {
      version: 1,
      scrollTop: Math.round(scrollTop),
      scrollHeight: wrapper.scrollHeight,
      clientWidth: wrapper.clientWidth,
      percentage: maxScrollTop === 0 ? 0 : scrollTop / maxScrollTop * 100,
      anchor: this.captureAnchor(wrapper, content),
    };
  }

  scrollTopForPosition(wrapper: HTMLElement, content: HTMLElement, position: ReaderPosition): number {
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

  toggleOverlayTranslation(content: HTMLElement, eventTarget: EventTarget | null): void {
    const closeOpenSegment = () => {
      content.querySelector('.fluent-segment-overlay.is-visible')?.classList.remove('is-visible');
    };
    const clickedSegment = eventTarget instanceof Element
      ? eventTarget.closest('.seg-pair > .segment')
      : null;

    if (!clickedSegment) {
      closeOpenSegment();
      return;
    }

    const overlay = clickedSegment.parentElement?.querySelector('.fluent-segment-overlay');
    if (!overlay) return;

    const wasVisible = overlay.classList.contains('is-visible');
    closeOpenSegment();
    if (!wasVisible) overlay.classList.add('is-visible');
  }

  synchronizeParallelColumns(content: HTMLElement): boolean {
    let changed = false;

    content.querySelectorAll<HTMLElement>('.chapter').forEach(wrapper => {
      const mainBlocks = wrapper.querySelectorAll<HTMLElement>('.sbs-column-main p, .sbs-column-main h2');
      const secondaryBlocks = wrapper.querySelectorAll<HTMLElement>('.sbs-column-secondary p, .sbs-column-secondary h2');
      const blockCount = Math.min(mainBlocks.length, secondaryBlocks.length);

      for (let index = 0; index < blockCount; index++) {
        const main = mainBlocks[index];
        const secondary = secondaryBlocks[index];
        main.style.minHeight = '';
        secondary.style.minHeight = '';
        const maxHeight = Math.max(main.offsetHeight, secondary.offsetHeight);

        if (Math.abs(main.offsetHeight - maxHeight) > 1) {
          main.style.minHeight = `${maxHeight}px`;
          changed = true;
        }
        if (Math.abs(secondary.offsetHeight - maxHeight) > 1) {
          secondary.style.minHeight = `${maxHeight}px`;
          changed = true;
        }
      }
    });

    return changed;
  }

  measureChapters(content: HTMLElement, targetLanguage: string | null): ReaderChapter[] {
    return Array.from(content.querySelectorAll<HTMLElement>('h2'))
      .map((heading, index): ReaderChapter | null => {
        if (!heading.id) return null;
        const titleSpan = targetLanguage
          ? heading.querySelector<HTMLElement>(`span.segment[lang="${CSS.escape(targetLanguage)}"]`)
          : null;
        const rawTitle = [titleSpan?.innerText, heading.innerText]
          .find(candidate => candidate?.trim()) ?? `Chapter ${index + 1}`;
        const title = rawTitle
          .replace(/\s+/g, ' ')
          .trim();

        return {title, offsetTop: heading.offsetTop, elementId: heading.id, index};
      })
      .filter((chapter): chapter is ReaderChapter => chapter !== null)
      .sort((a, b) => a.offsetTop - b.offsetTop);
  }

  findChapter(content: HTMLElement, elementId: string): HTMLElement | null {
    return Array.from(content.querySelectorAll<HTMLElement>('h2')).find(element => element.id === elementId) ?? null;
  }
}
