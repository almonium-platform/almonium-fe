import {Injectable} from '@angular/core';

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
