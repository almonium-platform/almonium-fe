import {TestBed, fakeAsync, flush, tick} from '@angular/core/testing';
import {Observable, of, throwError} from 'rxjs';
import {WorkUnlocks} from './catalog.model';
import {CatalogService} from './catalog.service';
import {PLAY_STEP_MS, UnlockMapComponent} from './unlock-map.component';
import {CountryShape, WorldAtlasService} from './world-atlas.service';

describe('UnlockMapComponent', () => {
  const square = (alpha2: string | null, name: string, x: number): CountryShape => ({
    alpha2, name,
    geometry: {type: 'Polygon', coordinates: [[[x, 0], [x + 10, 0], [x + 10, 10], [x, 10], [x, 0]]]},
  });
  const pooh: WorkUnlocks = {
    id: 'pooh', title: 'Winnie-the-Pooh', author: 'A. A. Milne', year: 1926, readerCountry: 'DE', readerFreeFrom: 2027,
    countries: [
      {country: 'CA', status: 'FREE', year: 2007, rule: 'Life + 50 for authors who died by 1971, life + 70 after'},
      {country: 'DE', status: 'PROTECTED', year: 2027, rule: "Author's life + 70 years"},
      {country: 'MX', status: 'PROTECTED', year: 2057, rule: "Author's life + 100 years"},
      {country: 'US', status: 'FREE', year: 2022, rule: '95 years after publication for works published before 1978, life + 70 after'},
    ],
  };
  const shapes = [square('DE', 'Germany', 0), square('US', 'United States of America', 20), square('MX', 'Mexico', 40), square(null, 'Kosovo', 60)];

  function setup(answer: Observable<WorkUnlocks> = of(pooh), outlines: Promise<CountryShape[]> = Promise.resolve(shapes)) {
    TestBed.configureTestingModule({
      imports: [UnlockMapComponent],
      providers: [
        {provide: CatalogService, useValue: {unlocks: jasmine.createSpy('unlocks').and.returnValue(answer)}},
        {provide: WorldAtlasService, useValue: {countries: () => outlines}},
      ],
    });
    const fixture = TestBed.createComponent(UnlockMapComponent);
    fixture.componentRef.setInput('catalogWorkId', 'pooh');
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement};
  }

  const fills = (host: HTMLElement) => Object.fromEntries([...host.querySelectorAll<SVGPathElement>('path.country')].map(p => [p.dataset['country'] ?? 'none', p.getAttribute('fill')]));

  it('draws every outline and colours it by the slider’s year, today first', fakeAsync(() => {
    const {fixture, host} = setup();
    flush();
    fixture.detectChanges();
    expect(host.textContent).toContain('Where it’s free to read');
    expect(host.textContent).toContain('Today it’s free to read in 2 countries. On 1 January 2027, 1 more, including Germany.');
    expect(fills(host)).toEqual({DE: 'var(--unlock-next)', US: 'var(--unlock-free)', MX: 'var(--unlock-protected)', none: 'var(--unlock-unchecked)'});
    expect(host.querySelector('.home text')?.textContent).toContain('You · Germany');

    const slider = host.querySelector<HTMLInputElement>('.slider')!;
    slider.value = '2030';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fills(host)['DE']).toBe('var(--unlock-free)');
    expect(fills(host)['MX']).toBe('var(--unlock-next)');
    expect(host.textContent).toContain('In 2030 it’s free to read in 3 countries.');
  }));

  it('plays through the years and stops at the end', fakeAsync(() => {
    const {fixture, host} = setup();
    flush();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.play')!.click();
    tick(PLAY_STEP_MS * 3);
    fixture.detectChanges();
    expect(host.querySelector('.yearlab')?.textContent).toBe(String(new Date().getFullYear() + 3));
    host.querySelector<HTMLButtonElement>('.play')!.click();
    tick(PLAY_STEP_MS * 3);
    fixture.detectChanges();
    expect(host.querySelector('.yearlab')?.textContent).toBe(String(new Date().getFullYear() + 3));
  }));

  it('names a hovered country with its date and rule', fakeAsync(() => {
    const {fixture, host} = setup();
    flush();
    fixture.detectChanges();
    host.querySelector<SVGPathElement>('path[data-country="MX"]')!.dispatchEvent(new MouseEvent('mousemove', {clientX: 10, clientY: 10}));
    fixture.detectChanges();
    expect(host.querySelector('.tip')?.textContent).toContain('Mexico');
    expect(host.querySelector('.tip')?.textContent).toContain('Free from 1 January 2057');
    expect(host.querySelector('.tip')?.textContent).toContain("Author's life + 100 years");
  }));

  it('lists the same countries by year for a phone, the reader’s own marked', fakeAsync(() => {
    const {fixture, host} = setup();
    flush();
    fixture.detectChanges();
    const groups = [...host.querySelectorAll('.unlock-list__group')].map(group => group.textContent?.replace(/\s+/g, ' ').trim());
    expect(groups).toEqual(['Free since 2007Canada', 'Free since 2022United States', 'Free from 1 January 2027Germany', 'Free from 1 January 2057Mexico']);
    expect(host.querySelector('.unlock-list__home')?.textContent).toBe('Germany');
  }));

  it('falls back to the list when the outlines or the data fail', fakeAsync(() => {
    const {fixture, host} = setup(of(pooh), Promise.reject(new Error('offline')));
    flush();
    fixture.detectChanges();
    expect(host.querySelector('.unlock-map--failed')).not.toBeNull();
    expect(host.querySelectorAll('.unlock-list__group').length).toBe(4);
    TestBed.resetTestingModule();
    const failed = setup(throwError(() => new Error('500')));
    flush();
    failed.fixture.detectChanges();
    expect(failed.host.textContent).toContain('The map didn’t load.');
  }));
});
