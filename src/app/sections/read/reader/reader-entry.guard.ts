import {inject} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router} from '@angular/router';
import {ReaderPositionStorage} from './reader-position-storage.service';

/**
 * `/reader/{slug}` is the reader's front door, not a page: it opens the chapter holding the place
 * kept on this device, else chapter 1 with a `resume` mark so a signed-in reader's server progress
 * can still pick the chapter once the book is known. Query parameters such as the companion travel along.
 */
export const readerEntryGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const privateId = route.paramMap.get('id');
  const slug = route.paramMap.get('slug');
  const bookKey = privateId ? `private:${privateId}` : `public:${slug}`;
  const chapter = inject(ReaderPositionStorage).get(bookKey)?.chapter;
  const path = privateId ? ['/reader', 'private', privateId] : ['/books', slug];
  return router.createUrlTree([...path, chapter ?? 1], {
    queryParams: chapter ? route.queryParams : {...route.queryParams, resume: 1},
  });
};
