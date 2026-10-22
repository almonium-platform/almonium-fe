import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {HttpErrorResponse} from '@angular/common/http';
import {of, throwError} from 'rxjs';
import {AppHttpError} from '../../shared/app-http-error';
import {RecentAuthGuardService} from '../../authentication/auth/recent-auth-guard.service';
import {CatalogHit} from '../../sections/read/catalog/catalog.model';
import {CatalogService} from '../../sections/read/catalog/catalog.service';
import {Demand, OpsDemandService, TextSource} from '../ops-demand.service';
import {OpsDemandComponent, preferredSource, previousSource} from './ops-demand.component';

describe('OpsDemandComponent', () => {
  const demand: Demand = {
    days: 30,
    wanted: [
      {catalogWorkId: 'c1', title: 'Dracula', author: 'Bram Stoker', year: 1897, language: 'FR', workSlug: 'dracula', readers: 12, status: 'OPEN',
        firstWantedAt: '2026-09-01T00:00:00Z', lastWantedAt: '2026-10-01T00:00:00Z', editorialUrl: 'https://editorial.example/new?work=c1', preparing: null},
      {catalogWorkId: 'c2', title: 'Emma', author: 'Jane Austen', year: 1815, language: 'DE', workSlug: null, readers: 3, status: 'IN_PROGRESS',
        firstWantedAt: '2026-09-01T00:00:00Z', lastWantedAt: '2026-10-01T00:00:00Z', editorialUrl: 'https://editorial.example/new?work=c2',
        preparing: {sourceKind: 'GUTENBERG', sourceUrl: 'https://www.gutenberg.org/ebooks/158', sourceLanguage: 'en', phase: 'leveling', stagesDone: 2, error: null}},
    ],
    underCopyright: [{catalogWorkId: 'c3', title: 'Lolita', author: 'Vladimir Nabokov', year: 1955, originalLanguage: 'EN', searches: 40, readers: 22, publisher: 'Olympia Press', freeFrom: 2048}],
    noMatch: [{query: 'drakula', searches: 5, readers: 4}],
  };
  const hit: CatalogHit = {
    id: 'c1', title: 'Dracula', originalTitle: null, originalLanguage: 'en', author: 'Bram Stoker', year: 1897, state: 'WANTABLE',
    workSlug: 'dracula', freeFrom: null, readers: null, wantedByMe: false, readerCountry: null, readerFreeFrom: null, freeIn: [],
  };

  const source = (id: string, extra: Partial<TextSource> = {}): TextSource => ({
    id, kind: 'GUTENBERG', language: 'fr', label: 'Dracula', translation: true, translators: [{name: 'Lucienne Molitor', birthYear: 1890, deathYear: 1950}],
    pageUrl: `https://www.gutenberg.org/ebooks/${id}`, downloadUrl: `https://www.gutenberg.org/ebooks/${id}.epub3.images`, status: 'FREE', freeFrom: null, ...extra,
  });
  const sources: TextSource[] = [
    source('en1', {language: 'en', translation: false, translators: []}),
    source('fr1'),
    source('fr2', {kind: 'WIKISOURCE', label: 'Dracula (1920)', status: 'PROTECTED', freeFrom: 2031, translators: [{name: 'Ève Paul-Margueritte', birthYear: 1885, deathYear: 1960}]}),
  ];

  function setup() {
    const ops = {
      sources: jasmine.createSpy('sources').and.returnValue(of(sources)),
      demand: jasmine.createSpy('demand').and.returnValue(of(demand)),
      start: jasmine.createSpy('start').and.returnValue(of(null)),
      decline: jasmine.createSpy('decline').and.returnValue(of(null)),
      alias: jasmine.createSpy('alias').and.returnValue(of(null)),
    };
    const search = jasmine.createSpy('search').and.returnValue(of([hit]));
    TestBed.configureTestingModule({
      imports: [OpsDemandComponent],
      providers: [
        {provide: OpsDemandService, useValue: ops},
        {provide: CatalogService, useValue: {search}},
        {provide: RecentAuthGuardService, useValue: {guardAction: (action: () => void) => action()}},
        {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
      ],
    });
    const fixture = TestBed.createComponent(OpsDemandComponent);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, ops, search};
  }

  const tabs = (host: HTMLElement) => Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

  it('counts each tab and lists the wanted rows first', () => {
    const {host, ops} = setup();
    expect(ops.demand).toHaveBeenCalledOnceWith(30);
    expect(tabs(host).map(tab => tab.textContent?.trim())).toEqual(['Wanted 2', 'Under copyright 1', 'No match 1']);
    const rows = host.querySelectorAll('.ops-queue--demand-wanted .ops-queue__row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Bram Stoker · 1897');
    expect(rows[0].textContent).toContain('Start');
    expect(rows[1].textContent).toContain('being prepared');
    expect(rows[1].textContent).toContain('Open catalogue');
  });

  const startButton = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('.ops-queue--demand-wanted .ops-queue__row .ops-button--primary')!;
  const pickerButton = (host: HTMLElement, label: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('.ops-demand__picker button')).find(button => button.textContent?.trim() === label)!;

  it('lists the work’s texts under Start, picks a free one in the wanted language, and greys a protected one with why', () => {
    const {fixture, host, ops} = setup();
    startButton(host).click();
    fixture.detectChanges();
    expect(ops.sources).toHaveBeenCalledOnceWith('c1');
    const options = host.querySelectorAll<HTMLLabelElement>('.ops-demand__source');
    expect(options.length).toBe(3);
    expect(options[0].textContent).toContain('Gutenberg · en · Dracula');
    expect(options[0].textContent).toContain('original');
    expect(options[1].textContent).toContain('translation by Lucienne Molitor (d. 1950)');
    expect(options[1].querySelector('a')?.getAttribute('href')).toBe('https://www.gutenberg.org/ebooks/fr1');
    expect(options[1].querySelector<HTMLInputElement>('input')!.checked).toBeTrue();
    expect(options[2].querySelector<HTMLInputElement>('input')!.disabled).toBeTrue();
    expect(options[2].textContent).toContain('under copyright');
    expect(options[2].textContent).toContain('Under copyright where we make books until 1 January 2031.');
    expect(startButton(host).textContent?.trim()).toBe('Close');
  });

  it('starts with the chosen text without opening the editorial catalogue', () => {
    const {fixture, host, ops} = setup();
    const opened = spyOn(window, 'open');
    startButton(host).click();
    fixture.detectChanges();
    host.querySelectorAll<HTMLInputElement>('.ops-demand__source input')[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();
    pickerButton(host, 'Start with this text').click();
    fixture.detectChanges();
    expect(ops.start).toHaveBeenCalledOnceWith(demand.wanted[0], 'en1');
    expect(opened).not.toHaveBeenCalled();
    expect(host.querySelector('.ops-demand__picker')).toBeNull();
    expect(ops.demand).toHaveBeenCalledTimes(2);
  });

  it('keeps Start with this text off until a text is picked, and says so', () => {
    const {fixture, host, ops} = setup();
    ops.sources.and.returnValue(of([source('de1', {language: 'de'})]));
    startButton(host).click();
    fixture.detectChanges();
    expect(pickerButton(host, 'Start with this text').disabled).toBeTrue();
    expect(host.querySelector('.ops-demand__hint')?.textContent).toContain('Pick a free or unknown text to start with it.');
  });

  it('shows the processor’s refusal inside the picker', () => {
    const {fixture, host, ops} = setup();
    ops.start.and.returnValue(throwError(() => new AppHttpError(new HttpErrorResponse({status: 409, error: {message: 'The book processor does not read fr yet.'}}))));
    startButton(host).click();
    fixture.detectChanges();
    pickerButton(host, 'Start with this text').click();
    fixture.detectChanges();
    expect(host.querySelector('.ops-demand__picker .ops-queue__error')?.textContent).toContain('The book processor does not read fr yet.');
  });

  it('starts without a text by opening the editorial catalogue, or declines the row', () => {
    const {fixture, host, ops} = setup();
    const opened = spyOn(window, 'open');
    startButton(host).click();
    fixture.detectChanges();
    pickerButton(host, 'Start without a text').click();
    expect(opened).toHaveBeenCalledOnceWith('https://editorial.example/new?work=c1', '_blank', 'noopener');
    expect(ops.start).toHaveBeenCalledOnceWith(demand.wanted[0]);
    fixture.detectChanges();
    const decline = Array.from(host.querySelectorAll<HTMLButtonElement>('.ops-queue--demand-wanted button')).find(button => button.textContent?.includes('Decline'))!;
    decline.click();
    expect(ops.decline).toHaveBeenCalledOnceWith(demand.wanted[0]);
    expect(ops.demand).toHaveBeenCalledTimes(3);
  });

  it('shows a row being prepared with its source, phase and four stages', () => {
    const {host} = setup();
    const preparing = host.querySelector('.ops-demand__preparing')!;
    const phases = Array.from(preparing.querySelectorAll('.ops-queue__phase'));
    expect(phases.map(phase => phase.textContent?.trim())).toEqual(['Text', 'Chapters', 'Level & words', 'On the shelf']);
    expect(phases.map(phase => phase.classList.contains('ops-queue__phase--done'))).toEqual([true, true, false, false]);
    expect(phases[2].classList).toContain('ops-queue__phase--on');
    expect(preparing.textContent).toContain('Gutenberg · en');
    expect(preparing.textContent).toContain('leveling');
    expect(preparing.querySelector('a')?.getAttribute('href')).toBe('https://www.gutenberg.org/ebooks/158');
    expect(preparing.querySelector('.ops-queue__error')).toBeNull();
  });

  it('shows a failed preparation’s error and stops the stage under way', () => {
    const {fixture, host, ops} = setup();
    const failed = {...demand.wanted[1], preparing: {...demand.wanted[1].preparing!, phase: 'failed', stagesDone: 1, error: 'EPUB download returned 404'}};
    ops.demand.and.returnValue(of({...demand, wanted: [demand.wanted[0], failed]}));
    Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'Refresh')!.click();
    fixture.detectChanges();
    const preparing = host.querySelector('.ops-demand__preparing')!;
    expect(preparing.querySelector('.ops-queue__error')?.textContent).toContain('EPUB download returned 404');
    expect(preparing.querySelector('.ops-queue__phase--on')).toBeNull();
    expect(preparing.querySelector('.ops-queue__stamp--failed')?.textContent).toContain('failed');
  });

  it('retries a failed preparation with a text, opening on the one it used', () => {
    const {fixture, host, ops} = setup();
    const failed = {...demand.wanted[1], preparing: {...demand.wanted[1].preparing!, sourceUrl: 'https://www.gutenberg.org/ebooks/en1', phase: 'failed', error: 'timeout'}};
    ops.demand.and.returnValue(of({...demand, wanted: [demand.wanted[0], failed]}));
    Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'Refresh')!.click();
    fixture.detectChanges();
    const retry = Array.from(host.querySelectorAll<HTMLButtonElement>('.ops-queue__row button')).find(button => button.textContent?.trim() === 'Try again with a text')!;
    retry.click();
    fixture.detectChanges();
    expect(ops.sources).toHaveBeenCalledOnceWith('c2');
    expect(host.querySelectorAll<HTMLInputElement>('.ops-demand__source input')[0].checked).toBeTrue();
    expect(pickerButton(host, 'Start without a text')).toBeUndefined();
    pickerButton(host, 'Start with this text').click();
    expect(ops.start).toHaveBeenCalledOnceWith(failed, 'en1');
  });

  it('offers no retry while a preparation is still running', () => {
    const {host} = setup();
    expect(host.querySelector('.ops-queue--demand-wanted')?.textContent).not.toContain('Try again with a text');
  });

  it('finds the text a failed preparation used only while it can still be chosen', () => {
    const used = (sourceUrl: string) => ({sourceKind: 'GUTENBERG', sourceUrl, sourceLanguage: 'fr', phase: 'failed', stagesDone: 0, error: null});
    expect(previousSource(sources, used('https://www.gutenberg.org/ebooks/fr1'))?.id).toBe('fr1');
    expect(previousSource(sources, used('https://www.gutenberg.org/ebooks/fr2'))).toBeNull();
    expect(previousSource(sources, used('https://elsewhere.example'))).toBeNull();
    expect(previousSource(sources, null)).toBeNull();
  });

  it('opens on the first text that can be chosen in the wanted language', () => {
    expect(preferredSource(sources, 'FR')?.id).toBe('fr1');
    expect(preferredSource(sources, 'EN')?.id).toBe('en1');
    expect(preferredSource([sources[2]], 'FR')).toBeNull();
    expect(preferredSource(sources, 'DE')).toBeNull();
  });

  it('shows searches for protected works with the publisher', () => {
    const {fixture, host} = setup();
    tabs(host)[1].click();
    fixture.detectChanges();
    const row = host.querySelector('.ops-queue--demand-copyright .ops-queue__row')!;
    expect(row.textContent).toContain('Lolita');
    expect(row.textContent).toContain('Vladimir Nabokov · 1955');
    expect(row.textContent).toContain('Olympia Press');
  });

  it('links a query that found nothing to the work it meant', fakeAsync(() => {
    const {fixture, host, ops, search} = setup();
    tabs(host)[2].click();
    fixture.detectChanges();
    host.querySelector<HTMLButtonElement>('.ops-queue--demand-nomatch .ops-button')!.click();
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();
    expect(search).toHaveBeenCalledOnceWith('drakula', 10);
    host.querySelector<HTMLButtonElement>('.ops-demand__hits button')!.click();
    expect(ops.alias).toHaveBeenCalledOnceWith('drakula', 'c1');
  }));

  it('reloads over another window', () => {
    const {fixture, host, ops} = setup();
    const week = Array.from(host.querySelectorAll<HTMLButtonElement>('.ops-demand__choice')).find(button => button.textContent?.trim() === '7 days')!;
    week.click();
    fixture.detectChanges();
    expect(ops.demand).toHaveBeenCalledWith(7);
  });
});
