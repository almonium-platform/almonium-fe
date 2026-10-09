import {TestBed} from '@angular/core/testing';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {of} from 'rxjs';
import {RecentAuthGuardService} from '../../authentication/auth/recent-auth-guard.service';
import {CatalogService} from '../../sections/read/catalog/catalog.service';
import {CatalogImportRun, OpsRightsService, RightsReportRow, WorkRightsRow, WorkRightsView} from '../ops-rights.service';
import {OpsRightsComponent} from './ops-rights.component';

describe('OpsRightsComponent', () => {
  const report: RightsReportRow = {
    id: 'r1', workSlug: 'lolita', editionSlug: 'lolita-original-en', bookTitle: 'Lolita', role: 'RIGHTS_HOLDER',
    reporterName: 'Dmitri', reporterEmail: 'estate@example.com', country: 'us', detectedCountry: 'US',
    message: 'Still protected in the US.', status: 'OPEN', createdAt: '2026-10-05T10:00:00Z', handledAt: null,
  };
  const works: WorkRightsRow[] = [
    {workSlug: 'emma', title: 'Emma', author: 'Jane Austen', linked: true, productionStatus: 'FREE', blockedEverywhere: false, blockedCountries: 0, overrides: 0},
    {workSlug: 'lolita', title: 'Lolita', author: 'Vladimir Nabokov', linked: true, productionStatus: 'PROTECTED', blockedEverywhere: true, blockedCountries: 1, overrides: 1},
  ];
  const view: WorkRightsView = {
    workSlug: 'lolita', title: 'Lolita', author: 'Vladimir Nabokov', catalogWorkId: 'c1', wikidataId: 'Q127149', publicationYear: 1955,
    authors: [{name: 'Vladimir Nabokov', wikidataId: 'Q36591', birthYear: 1899, deathYear: 1977, diedForFrance: false, rehabilitatedYear: null}],
    productionStatus: 'PROTECTED', productionFreeFrom: 2048, blockedCountries: {'*': 'ENGINE'}, protectedUntil: {DE: 2048, US: 2051},
    unknownCountries: [], overrides: [{id: 'o1', workSlug: 'lolita', country: '*', effect: 'BLOCK', reason: 'Estate asked', reportId: null, createdAt: '2026-10-01T00:00:00Z'}],
  };

  function setup(run: CatalogImportRun = {state: 'DONE', startedAt: null, finishedAt: null, works: 386000, titles: 900000, linked: 12, error: null}) {
    const rights = {
      reports: jasmine.createSpy().and.returnValue(of([report])),
      works: jasmine.createSpy().and.returnValue(of(works)),
      work: jasmine.createSpy().and.returnValue(of(view)),
      catalogImport: jasmine.createSpy().and.returnValue(of(run)),
      addOverride: jasmine.createSpy().and.returnValue(of({})),
      removeOverride: jasmine.createSpy().and.returnValue(of({})),
      dismissReport: jasmine.createSpy().and.returnValue(of({})),
      linkCatalogWork: jasmine.createSpy().and.returnValue(of(view)),
    };
    TestBed.configureTestingModule({
      imports: [OpsRightsComponent],
      providers: [
        {provide: OpsRightsService, useValue: rights},
        {provide: CatalogService, useValue: {search: () => of([])}},
        {provide: RecentAuthGuardService, useValue: {guardAction: (action: () => void) => action()}},
        {provide: TuiNotificationService, useValue: {open: () => of(undefined)}},
      ],
    });
    const fixture = TestBed.createComponent(OpsRightsComponent);
    fixture.detectChanges();
    return {fixture, host: fixture.nativeElement as HTMLElement, rights};
  }

  const button = (host: HTMLElement, text: string) =>
    [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim().startsWith(text))!;

  it('prefills the takedown from the report and settles the report with the override', () => {
    const {fixture, host, rights} = setup();
    expect(host.textContent).toContain('1 open report');
    button(host, 'Take down').click();
    fixture.detectChanges();
    const country = host.querySelector<HTMLInputElement>('.ops-rights__override input[formcontrolname="country"]')!;
    expect(country.value).toBe('US');
    expect(button(host, 'Block in US')).toBeTruthy();
    button(host, 'Block in US').click();
    expect(rights.addOverride).toHaveBeenCalledOnceWith({
      workSlug: 'lolita', country: 'US', effect: 'BLOCK', reason: 'Rights holder report from Dmitri: Still protected in the US.', reportId: 'r1',
    });
  });

  it('puts the work blocked everywhere first and opens its facts', () => {
    const {fixture, host, rights} = setup();
    const rows = host.querySelectorAll('.ops-queue--rights-works .ops-queue__row');
    expect(rows[0].textContent).toContain('Lolita');
    expect(rows[0].textContent).toContain('everywhere');
    button(rows[0] as HTMLElement, 'Open').click();
    fixture.detectChanges();
    expect(rights.work).toHaveBeenCalledOnceWith('lolita');
    const detail = host.querySelector('.ops-rights__detail')!;
    expect(detail.textContent).toContain('1899–1977');
    expect(detail.textContent).toContain('free from 2048');
    expect(detail.textContent).toContain('US 2051');
    button(detail as HTMLElement, 'Remove').click();
    expect(rights.removeOverride).toHaveBeenCalledOnceWith('o1');
  });

  it('says why Run import is greyed while an import runs', () => {
    const {host} = setup({state: 'RUNNING', startedAt: '2026-10-05T10:00:00Z', finishedAt: null, works: 0, titles: 0, linked: 0, error: null});
    expect(button(host, 'Run import').disabled).toBeTrue();
    expect(host.textContent).toContain('An import is running');
  });
});
