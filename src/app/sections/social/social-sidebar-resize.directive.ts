import {DOCUMENT} from '@angular/common';
import {Directive, OnDestroy, inject} from '@angular/core';

/** Owns the document-level pointer listeners and sizing rules for the chat sidebar. */
@Directive({
  selector: '[appSocialSidebarResize]',
  exportAs: 'socialSidebarResize',
})
export class SocialSidebarResizeDirective implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly view = this.document.defaultView;

  width = (this.view?.innerWidth ?? 1024) / 3 - 8;
  isCollapsed = false;
  isManuallyResized = false;
  private isResizing = false;

  start(): void {
    if (!this.view || this.view.innerWidth < 640) return;
    this.isResizing = true;
    this.isManuallyResized = true;
    this.document.addEventListener('mousemove', this.resize);
    this.document.addEventListener('mouseup', this.stop);
  }

  expand(): void {
    if (!this.isCollapsed) return;
    this.isCollapsed = false;
    this.isManuallyResized = true;
    this.width = (this.view?.innerWidth ?? 1024) / 3 - 8;
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private readonly resize = (event: MouseEvent): void => {
    if (!this.isResizing) return;
    this.width = Math.max(68, Math.min(600, event.clientX));
    this.isCollapsed = event.clientX < 68;
  };

  private readonly stop = (): void => {
    this.isResizing = false;
    this.document.removeEventListener('mousemove', this.resize);
    this.document.removeEventListener('mouseup', this.stop);
  };
}
