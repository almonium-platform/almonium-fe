import {HttpErrorResponse} from '@angular/common/http';
import {TestBed, discardPeriodicTasks, fakeAsync, tick} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {Observable, Subject, of, throwError} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {AppHttpError} from '../../../shared/app-http-error';
import {WantedService} from '../wanted/wanted.service';
import {CATALOG_DEBOUNCE_MS, CatalogResultsComponent} from './catalog-results.component';
import {CatalogHit} from './catalog.model';
import {CatalogService} from './catalog.service';
import {daysUntilNewYear} from './public-domain-day';
import {WorldAtlasService} from './world-atlas.service';

describe('CatalogResultsComponent', () => {
  const hit = (title: string, state: CatalogHit['state'], extra: Partial<CatalogHit> = {}): CatalogHit => ({
    id: title, title, originalTitle: null, originalLanguage: null, author: 'Jules Verne', year: 1870, state, workSlug: null, freeFrom: null, readers: null, wantedByMe: false, readerCountry: null, readerFreeFrom: null, freeIn: [], ...extra,
  });

  function setup(answers: Record<string, Observable<CatalogHit[]>>, authenticated = true) {
    const search = jasmine.createSpy('search').and.callFake((query: string) => answers[query] ?? of([]));
    const want = jasmine.createSpy('want').and.returnValue(of({catalogWorkId: 'x', language: LanguageCode.FR, rank: 2, readers: null}));
    const withdraw = jasmine.createSpy('withdraw').and.returnValue(of(null));
    const open = jasmine.createSpy('open').and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [CatalogResultsComponent],
      providers: [
        provideRouter([]),
        {provide: CatalogService, useValue: {search, unlocks: () => of({id: 'x', title: 'X', author: null, year: null, readerCountry: 'DE', readerFreeFrom: null, countries: []})}},
        {provide: WorldAtlasService, useValue: {countries: () => Promise.resolve([])}},
        {provide: WantedService, useValue: {want, withdraw}},
        {provide: TuiNotificationService, useValue: {open}},
      ],
    });
    const fixture = TestBed.createComponent(CatalogResultsComponent);
    fixture.componentRef.setInput('language', LanguageCode.FR);
    fixture.componentRef.setInput('authenticated', authenticated);
    const host = fixture.nativeElement as HTMLElement;
    const type = (query: string) => {
      fixture.componentRef.setInput('query', query);
      fixture.detectChanges();
      tick(CATALOG_DEBOUNCE_MS);
      fixture.detectChanges();
    };
    return {fixture, host, search, want, withdraw, open, type};
  }

  it('counts down on the copyright card when the day is in sight, and “Tell me on the day” is a want (W6)', fakeAsync(() => {
    const pooh = hit('Winnie-the-Pooh', 'UNDER_COPYRIGHT', {author: 'A. A. Milne', year: 1926, freeFrom: 2027, readerCountry: 'DE', readerFreeFrom: new Date().getFullYear() + 1, freeIn: ['US', 'CA']});
    const {fixture, host, want, type} = setup({pooh: of([pooh])});
    type('pooh');
    const card = host.querySelector('.copyright-card')!;
    expect(card.querySelector('.copyright-chip')?.textContent).toBe('Under copyright in Germany');
    expect(card.querySelectorAll('.unlock__tile').length).toBe(4);
    expect(card.textContent).toContain('It’s already free in United States and Canada.');
    expect(card.textContent).not.toContain('Import your copy');
    card.querySelector<HTMLButtonElement>('.want-button')!.click();
    fixture.detectChanges();
    expect(want).toHaveBeenCalledOnceWith('Winnie-the-Pooh', LanguageCode.FR);
    expect(card.querySelector('.want-button')?.textContent).toContain('We’ll tell you on 1 January');
    expect(host.querySelector('app-unlock-map')).toBeNull();
    card.querySelector<HTMLButtonElement>('.catalog-link')!.click();
    fixture.detectChanges();
    expect(host.querySelector('app-unlock-map')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('waits for the reader to stop typing and lists what the shelf lacks as rows, five at first', fakeAsync(() => {
    const rows = Array.from({length: 7}, (_, index) => hit(`Book ${index}`, 'WANTABLE'));
    const {fixture, host, search} = setup({verne: of([hit('On the shelf', 'ON_SHELF'), ...rows])});
    fixture.componentRef.setInput('query', 'ver');
    fixture.detectChanges();
    tick(100);
    fixture.componentRef.setInput('query', 'verne');
    fixture.detectChanges();
    tick(CATALOG_DEBOUNCE_MS);
    fixture.detectChanges();
    expect(search).toHaveBeenCalledOnceWith('verne', 20, LanguageCode.FR);
    expect(host.textContent).toContain('Not on the shelf yet');
    expect(host.textContent).not.toContain('On the shelf');
    expect(host.querySelectorAll('.catalog-row').length).toBe(5);
    expect(host.querySelector('.catalog-meta')?.textContent).toBe('Jules Verne · 1870');
    const more = host.querySelector<HTMLButtonElement>('.catalog-more')!;
    expect(more.textContent).toContain('Show 2 more');
    more.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('.catalog-row').length).toBe(7);
  }));

  it('drops the answer to a query the reader has already typed past', fakeAsync(() => {
    const stale = new Subject<CatalogHit[]>();
    const {host, type} = setup({jules: stale, verne: of([hit('Fresh', 'WANTABLE')])});
    type('jules');
    type('verne');
    stale.next([hit('Stale', 'WANTABLE')]);
    expect(host.textContent).toContain('Fresh');
    expect(host.textContent).not.toContain('Stale');
  }));

  it('does not ask the catalogue about a single letter, and shows nothing then', fakeAsync(() => {
    const {host, search, type} = setup({});
    type('v');
    expect(search).not.toHaveBeenCalled();
    expect(host.querySelector('.catalog')).toBeNull();
  }));

  it('wants a book in the shelf language, says its place in line, and takes it back silently', fakeAsync(() => {
    const {fixture, host, want, withdraw, open, type} = setup({verne: of([hit('Twenty Thousand Leagues', 'WANTABLE', {id: 'w1'})])});
    type('verne');
    host.querySelector<HTMLButtonElement>('.want-button')!.click();
    fixture.detectChanges();
    expect(want).toHaveBeenCalledOnceWith('w1', LanguageCode.FR);
    expect(open).toHaveBeenCalledOnceWith(jasmine.anything(), {appearance: 'positive', data: 'Added to Wanted. It’s 2nd in line.'});
    const wanted = host.querySelector<HTMLButtonElement>('.want-button--wanted')!;
    expect(wanted.textContent).toContain('✓ Wanted');

    wanted.click();
    fixture.detectChanges();
    expect(withdraw).toHaveBeenCalledOnceWith('w1', LanguageCode.FR);
    expect(open).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.want-button--wanted')).toBeNull();
    expect(host.querySelector('.want-button')?.textContent).toContain('I want this');
  }));

  it('starts from the search’s own wants and reader counts', fakeAsync(() => {
    const {host, type} = setup({verne: of([hit('Mine', 'WANTABLE', {readers: 7, wantedByMe: true}), hit('Quiet', 'WANTABLE')])});
    type('verne');
    const rows = host.querySelectorAll('.catalog-row');
    expect(rows[0].querySelector('.catalog-readers')?.textContent).toBe('7 readers');
    expect(rows[0].querySelector('.want-button--wanted')).not.toBeNull();
    expect(rows[1].querySelector('.catalog-readers')).toBeNull();
  }));

  it('shows the server’s reason under the row when a want is refused', fakeAsync(() => {
    const {fixture, host, want, open, type} = setup({verne: of([hit('Lolita', 'WANTABLE')])});
    want.and.returnValue(throwError(() => new AppHttpError(new HttpErrorResponse({status: 409, error: {message: 'This one is under copyright, so we can’t offer it.'}}))));
    type('verne');
    host.querySelector<HTMLButtonElement>('.want-button')!.click();
    fixture.detectChanges();
    expect(host.querySelector('.catalog-row__note')?.textContent).toContain('This one is under copyright, so we can’t offer it.');
    expect(host.querySelector('.want-button--wanted')).toBeNull();
    expect(open).not.toHaveBeenCalled();
  }));

  it('asks a guest to sign in instead of wanting', fakeAsync(() => {
    const {fixture, host, want, type} = setup({verne: of([hit('Michel Strogoff', 'WANTABLE')])}, false);
    type('verne');
    host.querySelector<HTMLButtonElement>('.want-button')!.click();
    fixture.detectChanges();
    expect(want).not.toHaveBeenCalled();
    expect(host.querySelector('.catalog-row__note')?.textContent).toContain('Sign in to want this book.');
  }));

  it('says a book is not for the reader’s country without offering anything', fakeAsync(() => {
    const {host, type} = setup({verne: of([hit('Blocked', 'NOT_IN_YOUR_COUNTRY')])});
    type('verne');
    expect(host.textContent).toContain('Not available in your country');
    expect(host.querySelector('.want-button')).toBeNull();
  }));

  it('shows the best hit under copyright as one plain card with the private import', fakeAsync(() => {
    const {fixture, host, type} = setup({lolita: of([hit('Lolita', 'UNDER_COPYRIGHT', {author: 'Vladimir Nabokov', year: 1955}), hit('Pnin', 'UNDER_COPYRIGHT')])});
    const imported = jasmine.createSpy('imported');
    fixture.componentInstance.importRequested.subscribe(imported);
    type('lolita');
    const card = host.querySelector('.copyright-card')!;
    expect(card.textContent).toContain('Lolita');
    expect(card.textContent).toContain('Vladimir Nabokov · 1955');
    expect(card.textContent).toContain('Under copyright');
    expect(card.querySelector('img')).toBeNull();
    expect(host.textContent).not.toContain('Pnin');
    host.querySelector<HTMLButtonElement>('.copyright-card .catalog-link')!.click();
    expect(imported).toHaveBeenCalledTimes(1);
  }));

  it('lets the shelf stand alone when the catalogue fails', fakeAsync(() => {
    const {host, type} = setup({verne: throwError(() => new Error('offline'))});
    type('verne');
    expect(host.querySelector('.catalog')).toBeNull();
  }));

  describe('public domain day', () => {
    const thisYear = new Date().getFullYear();
    const freeIn = (days: number) => days === 1 ? 'Free tomorrow' : `Free in ${days} days`;

    it('counts the protected best hit down when it frees up next 1 January', fakeAsync(() => {
      const {host, type} = setup({pooh: of([hit('Winnie-the-Pooh', 'UNDER_COPYRIGHT', {freeFrom: thisYear + 1})])});
      type('pooh');
      const chip = host.querySelector('.copyright-card .free-note--chip');
      expect(chip?.textContent).toContain(freeIn(daysUntilNewYear(thisYear + 1, new Date())));
    }));

    it('names the date and the years when it is later, and says nothing when the year is unknown', fakeAsync(() => {
      const {host, type} = setup({
        styles: of([hit('The Mysterious Affair at Styles', 'UNDER_COPYRIGHT', {freeFrom: thisYear + 21})]),
        potter: of([hit('Harry Potter', 'UNDER_COPYRIGHT')]),
      });
      type('styles');
      expect(host.querySelector('.copyright-card .free-note')?.textContent?.replace(/\s+/g, ' ').trim())
        .toBe(`Free on 1 January ${thisYear + 21} · in 21 years`);
      type('potter');
      expect(host.querySelector('.copyright-card')).not.toBeNull();
      expect(host.querySelector('.copyright-card .free-note')).toBeNull();
    }));

    it('notes a row that turned free this 1 January, and only that', fakeAsync(() => {
      const {host, type} = setup({brecht: of([
        hit('Baal', 'WANTABLE', {freeFrom: thisYear}),
        hit('Older', 'WANTABLE', {freeFrom: thisYear - 1}),
        hit('Elsewhere', 'NOT_IN_YOUR_COUNTRY', {freeFrom: thisYear}),
      ])});
      type('brecht');
      const rows = host.querySelectorAll('.catalog-row');
      expect(rows[0].querySelector('.free-note--since')?.textContent).toContain('Free since 1 January');
      expect(rows[1].querySelector('.free-note')).toBeNull();
      expect(rows[2].querySelector('.free-note')).toBeNull();
    }));
  });
});
