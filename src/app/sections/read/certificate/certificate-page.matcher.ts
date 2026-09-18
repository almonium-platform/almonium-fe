import {UrlMatchResult, UrlSegment} from '@angular/router';

/** `/read/@{username}/{editionSlug}` (design K1): the handle segment carries the at-sign, the reader's name does not. */
export function certificatePageMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length !== 3 || segments[0].path !== 'read') return null;
  const handle = segments[1].path;
  if (!handle.startsWith('@') || handle.length < 2) return null;
  return {
    consumed: segments,
    posParams: {username: new UrlSegment(handle.slice(1), {}), editionSlug: segments[2]},
  };
}
