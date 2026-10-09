import {TestBed} from '@angular/core/testing';
import {Observable, of, throwError} from 'rxjs';
import {LanguageCode} from '../../../models/language.enum';
import {CatalogHit} from './catalog.model';
import {CatalogService} from './catalog.service';
import {COMING_FREE_LIMIT, ComingFreeComponent} from './coming-free.component';

describe('ComingFreeComponent', () => {
  const nextYear = new Date().getFullYear() + 1;
  const hit = (title: string, extra: Partial<CatalogHit> = {}): CatalogHit => ({
    id: title, title, originalTitle: null, originalLanguage: 'de', author: 'Bertolt Brecht', year: 1928, state: 'UNDER_COPYRIGHT',
    workSlug: null, freeFrom: nextYear, readers: null, wantedByMe: false, ...extra,
  });

  function setup(answer: Observable<CatalogHit[]>, inputs: {language?: LanguageCode | null; preview?: number | null} = {}) {
    const comingFree = jasmine.createSpy('comingFree').and.returnValue(answer);
    TestBed.configureTestingModule({
      imports: [ComingFreeComponent],
      providers: [{provide: CatalogService, useValue: {comingFree}}],
    });
    const fixture = TestBed.createComponent(ComingFreeComponent);
    if (inputs.language !== undefined) fixture.componentRef.setInput('language', inputs.language);
    if (inputs.preview !== undefined) fixture.componentRef.setInput('preview', inputs.preview);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, comingFree};
  }

  it('asks for next 1 January’s works in the shelf language', () => {
    const {comingFree} = setup(of([]), {language: LanguageCode.DE});
    expect(comingFree).toHaveBeenCalledOnceWith(nextYear, COMING_FREE_LIMIT, LanguageCode.DE);
  });

  it('heads the list with the date and a countdown, and gives each row its readers but no button', () => {
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
