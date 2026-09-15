export interface ReaderPositionAnchor {
  path: number[];
  offset: number;
}

/**
 * A local, layout-aware bookmark. Server progress remains a percentage so it
 * can be shared across devices; this record is the precise bookmark for this
 * browser.
 */
export interface ReaderPosition {
  version: 1;
  scrollTop: number;
  scrollHeight: number;
  clientWidth: number;
  percentage: number;
  anchor: ReaderPositionAnchor | null;
}
