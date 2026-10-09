import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of, throwError} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {LanguageCode} from '../../../models/language.enum';
import {CEFRLevel} from '../../../models/userinfo.model';
import {AppHttpError} from '../../../shared/app-http-error';
import {CatalogHit} from '../catalog/catalog.model';
import {CatalogService} from '../catalog/catalog.service';
import {WantedComponent} from './wanted.component';
import {WantedQueue, WantedRow} from './wanted.model';
import {WantedService} from './wanted.service';

describe('WantedComponent', () => {
  const row = (title: string, extra: Partial<WantedRow> = {}): WantedRow => ({
    catalogWorkId: title, title, author: 'Jules Verne', language: LanguageCode.FR, workSlug: null, rank: 1, readers: null,
    wantedByMe: false, status: 'OPEN', stagesDone: null, ...extra,
  });
  const everyone: WantedQueue = {
    beingPrepared: [row('Emma', {author: 'Jane Austen', language: LanguageCode.DE, wantedByMe: true, status: 'IN_PROGRESS'})],
    queue: [
      row('Michel Strogoff', {rank: 2, readers: 12}),
      row('Dracula', {author: 'Bram Stoker', language: LanguageCode.PL, workSlug: 'dracula', rank: 3, wantedByMe: true}),
    ],
    recentlyArrived: [{catalogWorkId: 'a1', title: 'Persuasion', author: 'Jane Austen', language: LanguageCode.EN, editionSlug: 'persuasion-b2-en', cefrLevel: CEFRLevel.B2, coverUrl: null}],
    mineCount: 2,
  };
  const mine: WantedQueue = {beingPrepared: [], queue: [], recentlyArrived: [], mineCount: 0};

  function setup(
    queue = jasmine.createSpy('queue').and.callFake((onlyMine: boolean) => of(onlyMine ? mine : everyone)),
    comingFree: CatalogHit[] = [],
  ) {
    const want = jasmine.createSpy('want').and.returnValue(of({catalogWorkId: 'x', language: LanguageCode.FR, rank: 2, readers: null}));
    const withdraw = jasmine.createSpy('withdraw').and.returnValue(of(null));
    TestBed.configureTestingModule({
      imports: [WantedComponent],
      providers: [
        provideRouter([]),
        {provide: WantedService, useValue: {queue, want, withdraw}},
        {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
        {provide: CatalogService, useValue: {comingFree: () => of(comingFree)}},
      ],
    });
    const fixture = TestBed.createComponent(WantedComponent);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, queue, want, withdraw};
  }

  it('shows what is being prepared, the queue in order, and what arrived, without a date', () => {
    const {host} = setup();
    const prepared = host.querySelector('.prepared-card')!;
    expect(prepared.textContent).toContain('Being prepared');
    expect(prepared.textContent).toContain('Emma');
    expect(prepared.textContent).toContain('Jane Austen · German');
    expect(prepared.textContent).toContain('You want this');

    const rows = host.querySelectorAll('.wanted-rows')[0].querySelectorAll('.wanted-row');
    expect(rows[0].querySelector('.wanted-row__rank')?.textContent).toBe('2');
    expect(rows[0].querySelector('.wanted-meta')?.textContent).toBe('Jules Verne · French');
    expect(rows[0].querySelector('.wanted-readers')?.textContent).toBe('12 readers');
    expect(rows[1].querySelector('.wanted-meta')?.textContent).toBe('Bram Stoker · Polish edition');
    expect(rows[1].querySelector('.wanted-readers')).toBeNull();
    expect(rows[1].querySelector('.want-button--wanted')?.textContent).toContain('✓ Wanted');

    const arrived = host.querySelectorAll('.wanted-rows')[1];
    expect(arrived.textContent).toContain('Jane Austen · English · B2');
    expect(arrived.querySelector('a')?.getAttribute('href')).toBe('/books/persuasion-b2-en');
    expect(host.textContent).not.toMatch(/2026|Oct/);
  });

  it('switches to the reader’s own wants and says so when there are none', () => {
    const {fixture, host, queue} = setup();
    const yours = host.querySelectorAll<HTMLButtonElement>('.view-toggle button')[1];
    expect(yours.textContent).toContain('Yours · 2');
    yours.click();
    fixture.detectChanges();
    expect(queue).toHaveBeenCalledWith(true);
    expect(host.querySelector('.wanted-empty')?.textContent).toContain('Nothing yet. Search for a book you’d like to read.');
  });

  it('wants and withdraws from the queue, then reloads it', () => {
    const {fixture, host, queue, want, withdraw} = setup();
    const buttons = host.querySelectorAll<HTMLButtonElement>('.wanted-rows .want-button');
    buttons[0].click();
    fixture.detectChanges();
    expect(want).toHaveBeenCalledOnceWith('Michel Strogoff', LanguageCode.FR);
    buttons[1].click();
    fixture.detectChanges();
    expect(withdraw).toHaveBeenCalledOnceWith('Dracula', LanguageCode.PL);
    expect(queue).toHaveBeenCalledTimes(3);
  });

  it('shows a refusal under its row', () => {
    const {fixture, host, want} = setup();
    want.and.returnValue(throwError(() => new AppHttpError(new HttpErrorResponse({status: 409, error: {message: 'It’s already on the shelf in this language.'}}))));
    host.querySelector<HTMLButtonElement>('.wanted-rows .want-button')!.click();
    fixture.detectChanges();
    expect(host.querySelector('.wanted-row__note')?.textContent).toContain('It’s already on the shelf in this language.');
  });

  it('offers a retry when the queue fails to load', () => {
    const queue = jasmine.createSpy('queue').and.returnValues(throwError(() => new Error('offline')), of(everyone));
    const {fixture, host} = setup(queue);
    expect(host.textContent).toContain('Couldn’t load the queue.');
    host.querySelector<HTMLButtonElement>('.wanted-empty button')!.click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Michel Strogoff');
  });

  it('shows a card’s four stages when its work is prepared from a free text, and none otherwise', () => {
    const {host} = setup(jasmine.createSpy('queue').and.returnValue(of({
      ...everyone,
      beingPrepared: [
        row('Emma', {status: 'IN_PROGRESS', stagesDone: 2}),
        row('Persuasion', {status: 'IN_PROGRESS'}),
      ],
    })));
    const cards = host.querySelectorAll('.prepared-card');
    const stages = Array.from(cards[0].querySelectorAll('.stage'));
    expect(stages.map(stage => stage.querySelector('.stage__label')?.textContent?.replace(/,.*/, '').trim()))
      .toEqual(['Text', 'Chapters', 'Level & words', 'On the shelf']);
    expect(stages.map(stage => stage.className))
      .toEqual(['stage stage--done', 'stage stage--done', 'stage stage--current', 'stage stage--todo']);
    expect(stages[2].textContent).toContain('in progress');
    expect(cards[1].querySelector('.stages')).toBeNull();
  });

  it('counts down to Public Domain Day under the queue, without a want button', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 9, 12));
    try {
      const pooh: CatalogHit = {
        id: 'pooh', title: 'Winnie-the-Pooh', originalTitle: null, originalLanguage: 'en', author: 'A. A. Milne', year: 1926,
        state: 'UNDER_COPYRIGHT', workSlug: null, freeFrom: 2027, readers: null, wantedByMe: false,
      };
      const {host} = setup(undefined, [pooh]);
      const section = host.querySelector('.coming-free')!;
      expect(section.querySelector('h2')?.textContent).toContain('Free on 1 January 2027');
      expect(section.querySelector('.free-note--chip')?.textContent).toContain('Free in 84 days');
      const shelfRow = section.querySelector('.coming-free__row')!;
      expect(shelfRow.textContent).toContain('Winnie-the-Pooh');
      expect(shelfRow.textContent).toContain('A. A. Milne · 1926');
      expect(shelfRow.textContent).toContain('Free in 84 days');
      expect(shelfRow.querySelector('button')).toBeNull();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('leaves Public Domain Day out of the reader’s own wants and out when nothing frees up', () => {
    const {fixture, host} = setup();
    expect(host.querySelector('.coming-free')).toBeNull();
    host.querySelectorAll<HTMLButtonElement>('.view-toggle button')[1].click();
    fixture.detectChanges();
    expect(host.querySelector('app-coming-free')).toBeNull();
  });
});
