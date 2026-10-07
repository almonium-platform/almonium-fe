import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of} from 'rxjs';
import {RecentAuthGuardService} from '../../authentication/auth/recent-auth-guard.service';
import {CatalogHit} from '../../sections/read/catalog/catalog.model';
import {CatalogService} from '../../sections/read/catalog/catalog.service';
import {Demand, OpsDemandService} from '../ops-demand.service';
import {OpsDemandComponent} from './ops-demand.component';

describe('OpsDemandComponent', () => {
  const demand: Demand = {
    days: 30,
    wanted: [
      {catalogWorkId: 'c1', title: 'Dracula', author: 'Bram Stoker', year: 1897, language: 'FR', workSlug: 'dracula', readers: 12, status: 'OPEN',
        firstWantedAt: '2026-09-01T00:00:00Z', lastWantedAt: '2026-10-01T00:00:00Z', editorialUrl: 'https://editorial.example/new?work=c1'},
      {catalogWorkId: 'c2', title: 'Emma', author: 'Jane Austen', year: 1815, language: 'DE', workSlug: null, readers: 3, status: 'IN_PROGRESS',
        firstWantedAt: '2026-09-01T00:00:00Z', lastWantedAt: '2026-10-01T00:00:00Z', editorialUrl: 'https://editorial.example/new?work=c2'},
    ],
    underCopyright: [{catalogWorkId: 'c3', title: 'Lolita', author: 'Vladimir Nabokov', year: 1955, originalLanguage: 'EN', searches: 40, readers: 22, publisher: 'Olympia Press', freeFrom: 2048}],
    noMatch: [{query: 'drakula', searches: 5, readers: 4}],
  };
  const hit: CatalogHit = {
    id: 'c1', title: 'Dracula', originalTitle: null, originalLanguage: 'en', author: 'Bram Stoker', year: 1897, state: 'WANTABLE',
    workSlug: 'dracula', freeFrom: null, readers: null, wantedByMe: false,
  };

  function setup() {
    const ops = {
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
    expect(rows[0].textContent).toContain('Add edition');
    expect(rows[1].textContent).toContain('being prepared');
    expect(rows[1].textContent).toContain('Open catalogue');
  });

  it('opens the editorial catalogue and starts the row, or declines it', () => {
    const {host, ops} = setup();
    const opened = spyOn(window, 'open');
    host.querySelector<HTMLButtonElement>('.ops-queue--demand-wanted .ops-button--primary')!.click();
    expect(opened).toHaveBeenCalledOnceWith('https://editorial.example/new?work=c1', '_blank', 'noopener');
    expect(ops.start).toHaveBeenCalledOnceWith(demand.wanted[0]);
    const decline = Array.from(host.querySelectorAll<HTMLButtonElement>('.ops-queue--demand-wanted button')).find(button => button.textContent?.includes('Decline'))!;
    decline.click();
    expect(ops.decline).toHaveBeenCalledOnceWith(demand.wanted[0]);
    expect(ops.demand).toHaveBeenCalledTimes(3);
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
