import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {DatePipe, LowerCasePipe} from '@angular/common';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {Subject, of} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil} from 'rxjs/operators';
import {RecentAuthGuardService} from '../../authentication/auth/recent-auth-guard.service';
import {getErrorMessage} from '../../shared/http-error';
import {CatalogHit, catalogMeta, isCatalogQuery} from '../../sections/read/catalog/catalog.model';
import {CatalogService} from '../../sections/read/catalog/catalog.service';
import {
  CatalogAuthorFacts,
  CatalogImportRun,
  OpsRightsService,
  ReporterRole,
  RightsEffect,
  RightsOverrideRow,
  RightsReportRow,
  WorkRightsRow,
  WorkRightsView,
  authorLife,
  countryEntries,
  sortWorkRights,
  takedownCountry,
} from '../ops-rights.service';

const ROLE_LABELS: Record<ReporterRole, string> = {
  RIGHTS_HOLDER: 'Rights holder',
  READER: 'Reader',
  OTHER: 'Other',
};

/** `*` for everywhere, or an ISO alpha-2 code. */
const COUNTRY_PATTERN = /^\*$|^[A-Za-z]{2}$/;

/**
 * /ops → Rights. The report queue with its takedown, every shelf work with the facts and blocks behind it, and the
 * catalogue the facts come from. It sits inside the ops page and borrows its card and queue grammar.
 */
@Component({
  selector: 'app-ops-rights',
  imports: [ReactiveFormsModule, DatePipe, LowerCasePipe],
  templateUrl: './ops-rights.component.html',
  styleUrl: './ops-rights.component.less',
})
export class OpsRightsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private rightsService = inject(OpsRightsService);
  private catalogService = inject(CatalogService);
  private recentAuthGuardService = inject(RecentAuthGuardService);
  private alertService = inject(TuiNotificationService);
  private readonly destroy$ = new Subject<void>();

  protected readonly effects: RightsEffect[] = ['BLOCK', 'ALLOW'];

  // --- Reports ---

  protected reports: RightsReportRow[] | null = null;
  protected loadingReports = false;
  protected reportsError = '';
  protected decidingReport: string | null = null;
  /** The report whose takedown form is open under it. */
  protected takedownFor: string | null = null;
  protected takedownForm = this.overrideForm();

  // --- Works ---

  protected works: WorkRightsRow[] | null = null;
  protected loadingWorks = false;
  protected worksError = '';
  protected selected: WorkRightsView | null = null;
  protected loadingWork: string | null = null;
  protected workForm = this.overrideForm();
  protected savingOverride = false;
  protected removingOverride: string | null = null;
  protected catalogQuery = new FormControl('', {nonNullable: true});
  protected catalogHits: CatalogHit[] = [];
  protected linking: string | null = null;

  // --- Catalogue ---

  protected importRun: CatalogImportRun | null = null;
  protected importError = '';
  protected startingImport = false;
  protected recomputing = false;

  ngOnInit(): void {
    this.loadReports();
    this.loadWorks();
    this.loadImport();
    this.catalogQuery.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => isCatalogQuery(query.trim())
        ? this.catalogService.search(query.trim(), 10).pipe(catchError(() => of([] as CatalogHit[])))
        : of([] as CatalogHit[])),
      takeUntil(this.destroy$),
    ).subscribe(hits => this.catalogHits = hits);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private overrideForm() {
    return this.fb.nonNullable.group({
      country: ['*', [Validators.required, Validators.pattern(COUNTRY_PATTERN)]],
      effect: ['BLOCK' as RightsEffect, [Validators.required]],
      reason: ['', [Validators.required, Validators.maxLength(1000)]],
    });
  }

  private notify(message: string, appearance: 'positive' | 'negative'): void {
    this.alertService.open(message, {appearance}).subscribe();
  }

  protected roleLabel(role: ReporterRole): string {
    return ROLE_LABELS[role] ?? role;
  }

  protected get openReports(): number {
    return this.reports?.filter(report => report.status === 'OPEN').length ?? 0;
  }

  protected loadReports(): void {
    this.loadingReports = true;
    this.reportsError = '';
    this.rightsService.reports()
      .pipe(finalize(() => this.loadingReports = false))
      .subscribe({
        next: reports => this.reports = reports,
        error: error => {
          this.reports = null;
          this.reportsError = getErrorMessage(error, 'The rights reports could not be loaded');
        },
      });
  }

  protected onDismiss(report: RightsReportRow): void {
    if (this.decidingReport) return;
    this.recentAuthGuardService.guardAction(() => this.performDismiss(report), false, 'Dismiss');
  }

  private performDismiss(report: RightsReportRow): void {
    this.decidingReport = report.id;
    this.rightsService.dismissReport(report.id)
      .pipe(finalize(() => this.decidingReport = null))
      .subscribe({
        next: () => {
          this.notify(`Dismissed the report on ${report.bookTitle}.`, 'positive');
          if (this.takedownFor === report.id) this.takedownFor = null;
          this.loadReports();
        },
        error: error => this.notify(getErrorMessage(error, 'Failed to dismiss the report'), 'negative'),
      });
  }

  /** "Take down…": the override form under the report, set to block where the report points. */
  protected onOpenTakedown(report: RightsReportRow): void {
    if (this.takedownFor === report.id) {
      this.takedownFor = null;
      return;
    }
    this.takedownFor = report.id;
    const who = [report.reporterName, report.reporterEmail].find(value => !!value?.trim()) ?? this.roleLabel(report.role).toLowerCase();
    this.takedownForm.reset({
      country: takedownCountry(report),
      effect: 'BLOCK',
      reason: `${this.roleLabel(report.role)} report from ${who}: ${report.message}`.slice(0, 1000),
    });
  }

  protected onTakedown(report: RightsReportRow): void {
    if (this.savingOverride || this.takedownForm.invalid) {
      this.takedownForm.markAllAsTouched();
      return;
    }
    const {country, effect, reason} = this.takedownForm.getRawValue();
    this.recentAuthGuardService.guardAction(() => this.performOverride(report.workSlug, country, effect, reason, report.id), false, effect === 'BLOCK' ? 'Block' : 'Allow');
  }

  // --- Works ---

  protected loadWorks(): void {
    this.loadingWorks = true;
    this.worksError = '';
    this.rightsService.works()
      .pipe(finalize(() => this.loadingWorks = false))
      .subscribe({
        next: works => this.works = sortWorkRights(works),
        error: error => {
          this.works = null;
          this.worksError = getErrorMessage(error, 'The works could not be loaded');
        },
      });
  }

  protected get blockedEverywhereCount(): number {
    return this.works?.filter(work => work.blockedEverywhere).length ?? 0;
  }

  protected get unlinkedCount(): number {
    return this.works?.filter(work => !work.linked).length ?? 0;
  }

  protected blockedLabel(work: WorkRightsRow): string {
    if (work.blockedEverywhere) return 'everywhere';
    return work.blockedCountries ? `${work.blockedCountries} ${work.blockedCountries === 1 ? 'country' : 'countries'}` : '—';
  }

  protected onOpenWork(workSlug: string): void {
    if (this.selected?.workSlug === workSlug) {
      this.selected = null;
      return;
    }
    this.loadWork(workSlug);
  }

  private loadWork(workSlug: string): void {
    this.loadingWork = workSlug;
    this.rightsService.work(workSlug)
      .pipe(finalize(() => this.loadingWork = null))
      .subscribe({
        next: view => {
          const changed = this.selected?.workSlug !== view.workSlug;
          this.selected = view;
          if (changed) {
            this.workForm.reset({country: '*', effect: 'BLOCK', reason: ''});
            this.catalogQuery.setValue(view.title);
          }
        },
        error: error => this.notify(getErrorMessage(error, 'The work could not be loaded'), 'negative'),
      });
  }

  protected authorLife(author: CatalogAuthorFacts): string {
    return authorLife(author);
  }

  protected blockedRows(view: WorkRightsView) {
    return countryEntries(view.blockedCountries);
  }

  protected protectedRows(view: WorkRightsView) {
    return countryEntries(view.protectedUntil);
  }

  protected catalogMeta(hit: CatalogHit): string {
    return catalogMeta(hit);
  }

  protected onAddOverride(): void {
    const view = this.selected;
    if (!view || this.savingOverride || this.workForm.invalid) {
      this.workForm.markAllAsTouched();
      return;
    }
    const {country, effect, reason} = this.workForm.getRawValue();
    this.recentAuthGuardService.guardAction(() => this.performOverride(view.workSlug, country, effect, reason), false, effect === 'BLOCK' ? 'Block' : 'Allow');
  }

  private performOverride(workSlug: string, country: string, effect: RightsEffect, reason: string, reportId?: string): void {
    this.savingOverride = true;
    const code = country.trim().toUpperCase();
    this.rightsService.addOverride({workSlug, country: code, effect, reason: reason.trim(), ...(reportId ? {reportId} : {})})
      .pipe(finalize(() => this.savingOverride = false))
      .subscribe({
        next: () => {
          const where = code === '*' ? 'everywhere' : `in ${code}`;
          this.notify(`${effect === 'BLOCK' ? 'Blocked' : 'Allowed'} ${workSlug} ${where}. Every reader sees it within a minute.`, 'positive');
          if (reportId) {
            this.takedownFor = null;
            this.loadReports();
          } else {
            this.workForm.reset({country: '*', effect: 'BLOCK', reason: ''});
          }
          this.loadWorks();
          if (this.selected?.workSlug === workSlug) this.loadWork(workSlug);
        },
        error: error => this.notify(getErrorMessage(error, 'Failed to save the override'), 'negative'),
      });
  }

  protected onRemoveOverride(override: RightsOverrideRow): void {
    if (this.removingOverride) return;
    this.recentAuthGuardService.guardAction(() => this.performRemoveOverride(override), false, 'Remove');
  }

  private performRemoveOverride(override: RightsOverrideRow): void {
    this.removingOverride = override.id;
    this.rightsService.removeOverride(override.id)
      .pipe(finalize(() => this.removingOverride = null))
      .subscribe({
        next: () => {
          this.notify(`Removed the ${override.effect.toLowerCase()} on ${override.country}; the engine decides there again.`, 'positive');
          this.loadWorks();
          this.loadWork(override.workSlug);
        },
        error: error => this.notify(getErrorMessage(error, 'Failed to remove the override'), 'negative'),
      });
  }

  protected onLink(hit: CatalogHit): void {
    const view = this.selected;
    if (!view || this.linking) return;
    this.recentAuthGuardService.guardAction(() => this.performLink(view.workSlug, hit), false, 'Link');
  }

  private performLink(workSlug: string, hit: CatalogHit): void {
    this.linking = hit.id;
    this.rightsService.linkCatalogWork(workSlug, hit.id)
      .pipe(finalize(() => this.linking = null))
      .subscribe({
        next: view => {
          this.selected = view;
          this.notify(`${workSlug} now takes its facts from ${hit.title}.`, 'positive');
          this.loadWorks();
        },
        error: error => this.notify(getErrorMessage(error, 'Failed to link the catalogue work'), 'negative'),
      });
  }

  // --- Catalogue ---

  protected loadImport(): void {
    this.importError = '';
    this.rightsService.catalogImport().subscribe({
      next: run => this.importRun = run,
      error: error => {
        this.importRun = null;
        this.importError = getErrorMessage(error, 'The catalogue import status could not be loaded');
      },
    });
  }

  protected onRunImport(): void {
    if (this.startingImport || this.importRun?.state === 'RUNNING') return;
    this.recentAuthGuardService.guardAction(() => this.performRunImport(), false, 'Run import');
  }

  private performRunImport(): void {
    this.startingImport = true;
    this.rightsService.startCatalogImport()
      .pipe(finalize(() => this.startingImport = false))
      .subscribe({
        next: run => {
          this.importRun = run;
          this.notify('Catalogue import started. It takes a few minutes; refresh to follow it.', 'positive');
        },
        error: error => this.notify(getErrorMessage(error, 'Failed to start the import'), 'negative'),
      });
  }

  protected onRecompute(): void {
    if (this.recomputing) return;
    this.recentAuthGuardService.guardAction(() => this.performRecompute(), false, 'Recompute');
  }

  private performRecompute(): void {
    this.recomputing = true;
    this.rightsService.recompute()
      .pipe(finalize(() => this.recomputing = false))
      .subscribe({
        next: ({works}) => {
          this.notify(`Recomputed the blocks for ${works} ${works === 1 ? 'work' : 'works'}.`, 'positive');
          this.loadWorks();
          if (this.selected) this.loadWork(this.selected.workSlug);
        },
        error: error => this.notify(getErrorMessage(error, 'Failed to recompute the blocks'), 'negative'),
      });
  }
}
