import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {Observable, of, throwError} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {WantedService} from '../wanted/wanted.service';
import {CatalogHit} from './catalog.model';
import {CatalogService} from './catalog.service';
import {COMING_FREE_LIMIT, ComingFreeComponent} from './coming-free.component';

describe('ComingFreeComponent', () => {
  const nextYear = new Date().getFullYear() + 1;
  const hit = (title: string, extra: Partial<CatalogHit> = {}): CatalogHit => ({
    id: title, title, originalTitle: null, originalLanguage: 'de', author: 'Bertolt Brecht', year: 1928, state: 'UNDER_COPYRIGHT',
    workSlug: null, freeFrom: nextYear, readers: null, wantedByMe: false, readerCountry: null, readerFreeFrom: null, freeIn: [], ...extra,
  });

  function setup(answer: Observable<CatalogHit[]>, inputs: {language?: LanguageCode | null; preview?: number | null; seasonal?: boolean; authenticated?: boolean; now?: Date} = {}) {
    const comingFree = jasmine.createSpy('comingFree').and.returnValue(answer);
    const want = jasmine.createSpy('want').and.returnValue(of({catalogWorkId: 'x', language: LanguageCode.DE, rank: 1, readers: null}));
    const withdraw = jasmine.createSpy('withdraw').and.returnValue(of(null));
    TestBed.configureTestingModule({
      imports: [ComingFreeComponent],
      providers: [provideRouter([]), {provide: CatalogService, useValue: {comingFree}}, {provide: WantedService, useValue: {want, withdraw}}],
    });
    const fixture = TestBed.createComponent(ComingFreeComponent);
    if (inputs.now) fixture.componentInstance.now = () => inputs.now!;
    if (inputs.language !== undefined) fixture.componentRef.setInput('language', inputs.language);
    if (inputs.preview !== undefined) fixture.componentRef.setInput('preview', inputs.preview);
    if (inputs.seasonal !== undefined) fixture.componentRef.setInput('seasonal', inputs.seasonal);
    if (inputs.authenticated !== undefined) fixture.componentRef.setInput('authenticated', inputs.authenticated);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, comingFree, want, withdraw};
  }

  it('asks for next 1 January’s works in the shelf language', () => {
    const {comingFree} = setup(of([]), {language: LanguageCode.DE});
    expect(comingFree).toHaveBeenCalledOnceWith(nextYear, COMING_FREE_LIMIT, LanguageCode.DE);
  });

  it('heads the list with the date and a countdown, and gives each row its readers but no button without a language', () => {
    const {host} = setup(of([hit('The Threepenny Opera', {readers: 4}), hit('Baal')]));
    expect(host.querySelector('h2')?.textContent).toContain(`Free on 1 January ${nextYear}`);
    expect(host.querySelector('.kicker-row .free-note--chip')).not.toBeNull();
    const rows = host.querySelectorAll('.coming-free__row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.coming-free__meta')?.textContent).toBe('Bertolt Brecht · 1928');
    expect(rows[0].querySelector('.coming-free__readers')?.textContent).toBe('4 readers');
    expect(rows[1].querySelector('.coming-free__readers')).toBeNull();
    expect(rows[0].querySelector('.free-note--chip')).toBeNull();
    expect(rows[0].querySelector('.free-note')?.textContent).toMatch(/Free (in \d+ days|tomorrow)/);
    expect(host.querySelector('.coming-free__rows button')).toBeNull();
  });

  it('names the reader’s country and lets a member ask to be told on the day (W8)', () => {
    const {fixture, host, want, withdraw} = setup(of([hit('The Threepenny Opera', {readerCountry: 'DE'}), hit('Baal', {readerCountry: 'DE', wantedByMe: true})]), {language: LanguageCode.DE, authenticated: true});
    expect(host.querySelector('h2')?.textContent).toContain('Free in Germany from 1 January');
    const buttons = host.querySelectorAll<HTMLButtonElement>('.coming-free__rows .want-button');
    expect([...buttons].map(button => button.textContent?.trim())).toEqual(['Tell me', '✓ On the day']);
    buttons[0].click();
    fixture.detectChanges();
    expect(want).toHaveBeenCalledOnceWith('The Threepenny Opera', LanguageCode.DE);
    expect(host.querySelectorAll<HTMLButtonElement>('.coming-free__rows .want-button')[0].textContent).toContain('On the day');
    buttons[1].click();
    expect(withdraw).toHaveBeenCalledOnceWith('Baal', LanguageCode.DE);
  });

  it('sends a guest to sign in instead of wanting', () => {
    const {fixture, host, want} = setup(of([hit('Baal')]), {language: LanguageCode.DE, authenticated: false});
    host.querySelector<HTMLButtonElement>('.coming-free__rows .want-button')!.click();
    fixture.detectChanges();
    expect(want).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Sign in and we’ll tell you on the day.');
  });

  it('on the shelf shows only in season and only with three works lined up', () => {
    const three = [hit('A'), hit('B'), hit('C')];
    expect(setup(of(three), {seasonal: true, now: new Date(2026, 8, 30)}).host.querySelector('.coming-free')).toBeNull();
    TestBed.resetTestingModule();
    expect(setup(of(three), {seasonal: true, now: new Date(2026, 9, 1)}).host.querySelector('.coming-free')).not.toBeNull();
    TestBed.resetTestingModule();
    expect(setup(of(three.slice(0, 2)), {seasonal: true, now: new Date(2026, 11, 31)}).host.querySelector('.coming-free')).toBeNull();
  });

  it('through January the rail is “New this year” and an arrived work has a Read link', () => {
    const {host} = setup(of([hit('Baal', {state: 'ON_SHELF', workSlug: 'baal'}), hit('Mother Courage')]), {language: LanguageCode.DE, authenticated: true, now: new Date(2027, 0, 15)});
    expect(host.querySelector('h2')?.textContent).toContain('New this year');
    expect(host.querySelector('.want-button--read')?.getAttribute('href')).toBe('/books/baal');
    expect(host.querySelectorAll('.coming-free__rows button').length).toBe(0);
  });

  it('shows a preview and the rest on request', () => {
    const {fixture, host} = setup(of(['A', 'B', 'C', 'D', 'E'].map(title => hit(title))), {preview: 3});
    expect(host.querySelectorAll('.coming-free__row').length).toBe(3);
    const more = host.querySelector<HTMLButtonElement>('.coming-free__more')!;
    expect(more.textContent).toContain('Show 2 more');
    more.click();
    fixture.detectChanges();
    expect(host.querySelectorAll('.coming-free__row').length).toBe(5);
    expect(host.querySelector('.coming-free__more')).toBeNull();
  });

  it('stays away when nothing frees up or the catalogue does not answer', () => {
    expect(setup(of([])).host.querySelector('.coming-free')).toBeNull();
    TestBed.resetTestingModule();
    expect(setup(throwError(() => new Error('offline'))).host.querySelector('.coming-free')).toBeNull();
  });
});
