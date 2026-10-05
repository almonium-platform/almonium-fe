import {HttpErrorResponse} from '@angular/common/http';
import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {Observable, Subject, of, throwError} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {AppHttpError} from '../../../shared/app-http-error';
import {ReadService} from '../read.service';
import {CATALOG_DEBOUNCE_MS, CatalogResultsComponent} from './catalog-results.component';
import {CatalogHit} from './catalog.model';
import {CatalogService} from './catalog.service';

describe('CatalogResultsComponent', () => {
  const hit = (title: string, state: CatalogHit['state'], extra: Partial<CatalogHit> = {}): CatalogHit => ({
    id: title, title, originalTitle: null, originalLanguage: null, author: 'Jules Verne', year: 1870, state, workSlug: null, freeFrom: null, ...extra,
  });

  function setup(answers: Record<string, Observable<CatalogHit[]>>, authenticated = true) {
    const search = jasmine.createSpy('search').and.callFake((query: string) => answers[query] ?? of([]));
    const askForBook = jasmine.createSpy('askForBook').and.returnValue(of({}));
    const open = jasmine.createSpy('open').and.returnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [CatalogResultsComponent],
      providers: [
        provideRouter([]),
        {provide: CatalogService, useValue: {search}},
        {provide: ReadService, useValue: {askForBook}},
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
    return {fixture, host, search, askForBook, open, type};
  }

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
    expect(search).toHaveBeenCalledOnceWith('verne');
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

  it('wants a book through the ask flow in the shelf language, and a repeated ask counts as wanted', fakeAsync(() => {
    const {fixture, host, askForBook, type} = setup({verne: of([hit('Twenty Thousand Leagues', 'WANTABLE', {workSlug: 'twenty-thousand-leagues'}), hit('Around the World', 'WANTABLE')])});
    type('verne');
    host.querySelector<HTMLButtonElement>('.want-button')!.click();
    fixture.detectChanges();
    expect(askForBook).toHaveBeenCalledOnceWith({title: 'Twenty Thousand Leagues', author: 'Jules Verne', language: LanguageCode.FR, workSlug: 'twenty-thousand-leagues'});
    expect(host.querySelectorAll('.catalog-wanted').length).toBe(1);

    askForBook.and.returnValue(throwError(() => new AppHttpError(new HttpErrorResponse({status: 409, error: {message: 'You’ve asked for this one.'}}))));
    host.querySelector<HTMLButtonElement>('.want-button')!.click();
    fixture.detectChanges();
    expect(askForBook).toHaveBeenCalledWith({title: 'Around the World', author: 'Jules Verne', language: LanguageCode.FR});
    expect(host.querySelectorAll('.catalog-wanted').length).toBe(2);
    expect(host.textContent).toContain('✓ Wanted');
  }));

  it('asks a guest to sign in instead of wanting', fakeAsync(() => {
    const {fixture, host, askForBook, type} = setup({verne: of([hit('Michel Strogoff', 'WANTABLE')])}, false);
    type('verne');
    host.querySelector<HTMLButtonElement>('.want-button')!.click();
    fixture.detectChanges();
    expect(askForBook).not.toHaveBeenCalled();
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
});
