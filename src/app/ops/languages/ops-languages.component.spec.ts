import {TestBed} from '@angular/core/testing';
import {of} from 'rxjs';
import {LanguagePulse, OpsLanguagesService, lexiconShare} from '../ops-languages.service';
import {OpsLanguagesComponent} from './ops-languages.component';

describe('OpsLanguagesComponent', () => {
  const pulse: LanguagePulse = {
    generatedAt: '2026-10-26T12:00:00Z',
    days: 7,
    since: '2026-10-19T12:00:00Z',
    languages: [
      {language: 'DE', learners: 4, learnersSeenToday: 1, learnersSeen: 3, lookupsToday: 5, lookups: 40, searchers: 9,
        answeredByLexicon: 10, lemmas: 120, topMisses: [{query: 'kerl', lookups: 6, searchers: 4}]},
      {language: 'EN', learners: 2, learnersSeenToday: 0, learnersSeen: 1, lookupsToday: 0, lookups: 0, searchers: 0,
        answeredByLexicon: 0, lemmas: 900, topMisses: []},
    ],
  };

  function setup() {
    const service = {pulse: jasmine.createSpy('pulse').and.returnValue(of(pulse))};
    TestBed.configureTestingModule({
      imports: [OpsLanguagesComponent],
      providers: [{provide: OpsLanguagesService, useValue: service}],
    });
    const fixture = TestBed.createComponent(OpsLanguagesComponent);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, service};
  }

  it('loads the last seven days and shows one row per language with the lexicon share', () => {
    const {host, service} = setup();

    expect(service.pulse).toHaveBeenCalledWith(7);
    const rows = Array.from(host.querySelectorAll('tbody tr')).map(row => row.textContent.replace(/\s+/g, ' ').trim());
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('German');
    expect(rows[0]).toContain('25%');
    expect(rows[1]).toContain('English');
    expect(rows[1]).toContain('—');
  });

  it('opens a language for the words its lexicon lacked', () => {
    const {fixture, host} = setup();

    host.querySelector<HTMLButtonElement>('.ops-languages__toggle')!.click();
    fixture.detectChanges();

    expect(host.querySelector('.ops-languages__misses')!.textContent).toContain('kerl');
    expect(host.querySelector('.ops-languages__misses')!.textContent).toContain('4 lookers · 6 lookups');
  });

  it('reloads for another window', () => {
    const {fixture, host, service} = setup();

    const chips = Array.from(host.querySelectorAll<HTMLButtonElement>('.ops-languages__choice'));
    chips.find(chip => chip.textContent.includes('30 days'))!.click();
    fixture.detectChanges();

    expect(service.pulse).toHaveBeenCalledWith(30);
  });
});

describe('lexiconShare', () => {
  it('is a whole percent, or null when nothing was looked up', () => {
    expect(lexiconShare({lookups: 3, answeredByLexicon: 1})).toBe(33);
    expect(lexiconShare({lookups: 0, answeredByLexicon: 0})).toBeNull();
  });
});
