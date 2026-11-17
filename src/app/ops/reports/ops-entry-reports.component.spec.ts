import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {EntryReportGroup, OpsEntryReportsService} from '../ops-entry-reports.service';
import {OpsEntryReportsComponent} from './ops-entry-reports.component';

describe('OpsEntryReportsComponent', () => {
  const groups: EntryReportGroup[] = [
    {language: 'DE', headword: 'Haus', senseKey: 'key-1', definition: 'a building to live in', reason: 'BAD_EXAMPLE', reports: 3,
      reporters: 2, zipf: 5.5, entryVersion: 2, currentVersion: 3, firstAt: '2026-11-16T10:00:00Z', lastAt: '2026-11-17T10:00:00Z',
      items: [{comment: 'The example is about a boat.', context: 'Das Haus ist alt.', book: 'kafka-de', entryVersion: 2, createdAt: '2026-11-17T10:00:00Z'}]},
    {language: 'DE', headword: 'Kerl', senseKey: null, definition: null, reason: 'WRONG_SOUND', reports: 1, reporters: 1, zipf: null,
      entryVersion: 1, currentVersion: 1, firstAt: '2026-11-17T09:00:00Z', lastAt: '2026-11-17T09:00:00Z',
      items: [{comment: null, context: null, book: null, entryVersion: 1, createdAt: '2026-11-17T09:00:00Z'}]},
  ];

  function setup() {
    const service = {
      queue: jasmine.createSpy('queue').and.returnValue(of(groups)),
      resolve: jasmine.createSpy('resolve').and.returnValue(of({resolved: 3})),
    };
    TestBed.configureTestingModule({
      imports: [OpsEntryReportsComponent],
      providers: [provideRouter([]), {provide: OpsEntryReportsService, useValue: service}],
    });
    const fixture = TestBed.createComponent(OpsEntryReportsComponent);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, service};
  }

  function rows(host: HTMLElement): string[] {
    return Array.from(host.querySelectorAll('tbody tr')).map(row => (row.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  it('shows one row per sense and reason in the order the backend ranks them', () => {
    const {host} = setup();

    const lines = rows(host);
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('Haus');
    expect(lines[0]).toContain('a building to live in');
    expect(lines[0]).toContain('Bad example');
    expect(lines[0]).toContain('2 people');
    expect(lines[0]).toContain('rewritten since (v2 → v3)');
    expect(lines[1]).toContain('the whole word');
    expect(lines[1]).toContain('Wrong sound');
  });

  it('opens a row onto its reports with the sentence, the book and the note', () => {
    const {fixture, host} = setup();

    host.querySelector<HTMLButtonElement>('.ops-reports__toggle')!.click();
    fixture.detectChanges();

    const items = host.querySelector('.ops-reports__items')!.textContent ?? '';
    expect(items).toContain('Das Haus ist alt.');
    expect(items).toContain('kafka-de');
    expect(items).toContain('The example is about a boat.');
    expect(items).toContain('The newest 1 of 3.');
  });

  it('resolves a row and takes it off the queue', () => {
    const {fixture, host, service} = setup();

    host.querySelectorAll<HTMLButtonElement>('tbody tr')[1].querySelector<HTMLButtonElement>('.ops-button')!.click();
    fixture.detectChanges();

    expect(service.resolve).toHaveBeenCalledWith(jasmine.objectContaining({headword: 'Kerl', senseKey: null, reason: 'WRONG_SOUND'}));
    expect(rows(host).length).toBe(1);
  });
});
