export interface ReaderPositionAnchor {
  path: number[];
  offset: number;
}

/**
 * A local, layout-aware bookmark: the chapter page and the place within it. Server progress
 * remains a whole-book percentage so it can be shared across devices; this record is the precise
 * bookmark for this browser, and the chapter is what the book page and the reader entry resolve.
 */
export interface ReaderPosition {
  version: 2;
  chapter: number;
  /** The rendering the anchor path was captured in; a path only resolves in the same one. */
  presentation: string;
  scrollTop: number;
  scrollHeight: number;
  clientWidth: number;
  percentage: number;
  anchor: ReaderPositionAnchor | null;
}
