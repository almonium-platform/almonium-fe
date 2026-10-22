import {TestBed} from '@angular/core/testing';
import {CatalogHit} from './catalog.model';
import {UnlockCountdownComponent} from './unlock-countdown.component';

describe('UnlockCountdownComponent', () => {
  const hit = (extra: Partial<CatalogHit> = {}): CatalogHit => ({
    id: 'pooh', title: 'Winnie-the-Pooh', originalTitle: null, originalLanguage: 'en', author: 'A. A. Milne', year: 1926, state: 'UNDER_COPYRIGHT',
    workSlug: null, freeFrom: 2027, readers: null, wantedByMe: false, readerCountry: 'DE', readerFreeFrom: 2027, freeIn: ['US', 'CA', 'IN'], ...extra,
  });

  function setup(work: CatalogHit, now: Date, inputs: {wanted?: boolean} = {}) {
    TestBed.configureTestingModule({imports: [UnlockCountdownComponent]});
    const fixture = TestBed.createComponent(UnlockCountdownComponent);
    fixture.componentInstance.now = () => now;
    fixture.componentRef.setInput('hit', work);
    if (inputs.wanted !== undefined) fixture.componentRef.setInput('wanted', inputs.wanted);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement};
  }

  afterEach(() => TestBed.resetTestingModule());

  it('counts down to midnight on 1 January in the reader’s country and names where it is free already', () => {
    // Late November: no clock change left between now and the day, so the hours read plainly.
    const {host} = setup(hit(), new Date(2026, 10, 22, 12, 0, 0));
    expect(host.textContent).toContain('Free to read in Germany in');
    const numbers = [...host.querySelectorAll('.unlock__number')].map(tile => tile.textContent);
    expect(numbers).toEqual(['39', '12', '0', '0']);
    expect(host.textContent).toContain('On 1 January 2027.');
    expect(host.textContent).toContain('It’s already free in United States, Canada and India.');
    expect(host.querySelector('.want-button')?.textContent).toContain('Tell me on the day');
  });

  it('drops the days tile under a day away and advances with the clock', () => {
    let now = new Date(2026, 11, 31, 23, 59, 58);
    const {fixture, host} = setup(hit(), now);
    fixture.componentInstance.now = () => now;
    expect([...host.querySelectorAll('.unlock__number')].map(tile => tile.textContent)).toEqual(['0', '0', '2']);
    now = new Date(2026, 11, 31, 23, 59, 59);
    fixture.componentInstance.tick();
    fixture.detectChanges();
    expect([...host.querySelectorAll('.unlock__number')].map(tile => tile.textContent)).toEqual(['0', '0', '1']);
  });

  it('names the date instead when the day is more than five years away', () => {
    const {host} = setup(hit({readerFreeFrom: 2037}), new Date(2026, 9, 22));
    expect(host.querySelector('.unlock__tiles')).toBeNull();
    expect(host.textContent).toContain('Free to read in Germany from 1 January 2037.');
  });

  it('shows nothing when the server could not name the reader’s year', () => {
    const {host} = setup(hit({readerFreeFrom: null}), new Date(2026, 9, 22));
    expect(host.querySelector('.unlock')).toBeNull();
  });

  it('turns the button into a promise once wanted, and lets the reader take it back or open the map', () => {
    const {fixture, host} = setup(hit(), new Date(2026, 9, 22), {wanted: true});
    const toggle = jasmine.createSpy('toggle');
    const whereFree = jasmine.createSpy('whereFree');
    fixture.componentInstance.toggled.subscribe(toggle);
    fixture.componentInstance.whereFree.subscribe(whereFree);
    const button = host.querySelector<HTMLButtonElement>('.want-button')!;
    expect(button.textContent).toContain('We’ll tell you on 1 January');
    button.click();
    host.querySelector<HTMLButtonElement>('.catalog-link')!.click();
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(whereFree).toHaveBeenCalledTimes(1);
  });
});
