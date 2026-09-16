import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, convertToParamMap, provideRouter} from '@angular/router';
import {ReaderPositionStorage} from './reader-position-storage.service';
import {readerEntryGuard} from './reader-entry.guard';

describe('readerEntryGuard', () => {
  function run(params: Record<string, string>, query: Record<string, string>, chapter: number | null): string {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({providers: [provideRouter([]), {provide: ReaderPositionStorage, useValue: {get: () => chapter === null ? null : {chapter}}}]});
    const route = {paramMap: convertToParamMap(params), queryParams: query} as unknown as ActivatedRouteSnapshot;
    const tree = TestBed.runInInjectionContext(() => readerEntryGuard(route, {} as RouterStateSnapshot)) as UrlTree;
    return TestBed.inject(Router).serializeUrl(tree);
  }

  it('opens the chapter kept on this device, keeping the companion', () => {
    expect(run({slug: 'frankenstein'}, {parallel: 'frankenstein-uk'}, 11)).toBe('/books/frankenstein/11?parallel=frankenstein-uk');
  });

  it('falls back to chapter 1 and asks the reader to resume from the server', () => {
    expect(run({slug: 'frankenstein'}, {}, null)).toBe('/books/frankenstein/1?resume=1');
    expect(run({id: '01989f47-4c2a-7a10-9e5b-751983624a25'}, {}, null)).toBe('/reader/private/01989f47-4c2a-7a10-9e5b-751983624a25/1?resume=1');
  });
});
