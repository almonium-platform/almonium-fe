import {DOCUMENT} from '@angular/common';
import {Directive, OnDestroy, OnInit, inject} from '@angular/core';
import {LocalStorageService} from '../../services/local-storage.service';

const SIDEBAR_WIDTH_KEY = 'social_sidebar_width';

/** Rail, default, wide. The list settles on one of these rather than anywhere. */
const SNAPS = [72, 280, 420] as const;
const SNAP_TOLERANCE_PX = 26;
const MIN_WIDTH = SNAPS[0];
const MAX_WIDTH = 600;

/** Owns the document-level pointer listeners and sizing rules for the chat sidebar. */
@Directive({
  selector: '[appSocialSidebarResize]',
  exportAs: 'socialSidebarResize',
})
export class SocialSidebarResizeDirective implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly localStorage = inject(LocalStorageService);
  private readonly view = this.document.defaultView;

  width: number = SNAPS[1];
  isCollapsed = false;
  isManuallyResized = false;
  isDragging = false;
  private isResizing = false;

  ngOnInit(): void {
    const stored = this.localStorage.getItem<number>(SIDEBAR_WIDTH_KEY);
    if (typeof stored !== 'number' || !Number.isFinite(stored)) return;
    this.width = this.clamp(stored);
    this.isCollapsed = this.width <= MIN_WIDTH;
    this.isManuallyResized = true;
  }

  start(): void {
    if (!this.view || this.view.innerWidth < 640) return;
    this.isResizing = true;
    this.isDragging = true;
    this.isManuallyResized = true;
    this.document.addEventListener('mousemove', this.resize);
    this.document.addEventListener('mouseup', this.stop);
  }

  expand(): void {
    if (!this.isCollapsed) return;
    this.isCollapsed = false;
    this.isManuallyResized = true;
    this.width = SNAPS[1];
    this.persist();
  }

  /** Double-click the handle to swap between the rail and the default width. */
  toggleRail(): void {
    this.isManuallyResized = true;
    this.width = this.isCollapsed ? SNAPS[1] : MIN_WIDTH;
    this.isCollapsed = this.width <= MIN_WIDTH;
    this.persist();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private readonly resize = (event: MouseEvent): void => {
    if (!this.isResizing) return;
    this.width = this.clamp(event.clientX);
    this.isCollapsed = this.width <= MIN_WIDTH;
  };

  private readonly stop = (): void => {
    const wasResizing = this.isResizing;
    this.isResizing = false;
    this.isDragging = false;
    this.document.removeEventListener('mousemove', this.resize);
    this.document.removeEventListener('mouseup', this.stop);
    if (!wasResizing) return;
    this.width = this.snap(this.width);
    this.isCollapsed = this.width <= MIN_WIDTH;
    this.persist();
  };

  private clamp(value: number): number {
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value));
  }

  /** Release near a snap and the list lands on it; elsewhere the width is kept as dragged. */
  private snap(value: number): number {
    const nearest = SNAPS.find(snap => Math.abs(value - snap) <= SNAP_TOLERANCE_PX);
    return nearest ?? value;
  }

  private persist(): void {
    this.localStorage.saveItem(SIDEBAR_WIDTH_KEY, this.width);
  }
}
