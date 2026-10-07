import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of, throwError} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {LanguageCode} from '../../../models/language.enum';
import {CEFRLevel} from '../../../models/userinfo.model';
import {AppHttpError} from '../../../shared/app-http-error';
import {WantedComponent} from './wanted.component';
import {WantedQueue, WantedRow} from './wanted.model';
import {WantedService} from './wanted.service';

describe('WantedComponent', () => {
  const row = (title: string, extra: Partial<WantedRow> = {}): WantedRow => ({
    catalogWorkId: title, title, author: 'Jules Verne', language: LanguageCode.FR, workSlug: null, rank: 1, readers: null,
    wantedByMe: false, status: 'OPEN', ...extra,
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

  function setup(queue = jasmine.createSpy('queue').and.callFake((onlyMine: boolean) => of(onlyMine ? mine : everyone))) {
    const want = jasmine.createSpy('want').and.returnValue(of({catalogWorkId: 'x', language: LanguageCode.FR, rank: 2, readers: null}));
    const withdraw = jasmine.createSpy('withdraw').and.returnValue(of(null));
    TestBed.configureTestingModule({
      imports: [WantedComponent],
      providers: [
        provideRouter([]),
        {provide: WantedService, useValue: {queue, want, withdraw}},
        {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
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
});
