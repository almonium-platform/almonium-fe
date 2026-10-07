import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {LowerCasePipe} from '@angular/common';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {Subject, of} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil} from 'rxjs/operators';
import {RecentAuthGuardService} from '../../authentication/auth/recent-auth-guard.service';
import {getErrorMessage} from '../../shared/http-error';
import {CatalogHit, catalogMeta, isCatalogQuery} from '../../sections/read/catalog/catalog.model';
import {CatalogService} from '../../sections/read/catalog/catalog.service';
import {Demand, DemandNoMatchRow, DemandWantedRow, OpsDemandService, demandWorkMeta} from '../ops-demand.service';

export type DemandTab = 'wanted' | 'underCopyright' | 'noMatch';
export const DEMAND_WINDOWS = [7, 30, 90] as const;

/**
 * /ops → Demand (W5), replacing the book-requests queue: what readers want, what they searched for that is still
 * under copyright, and what they searched for that matched nothing. It borrows the ops page's card and queue grammar.
 */
@Component({
  selector: 'app-ops-demand',
  imports: [ReactiveFormsModule, LowerCasePipe],
  templateUrl: './ops-demand.component.html',
  styleUrl: './ops-demand.component.less',
})
export class OpsDemandComponent implements OnInit, OnDestroy {
  private demandService = inject(OpsDemandService);
  private catalogService = inject(CatalogService);
  private recentAuthGuardService = inject(RecentAuthGuardService);
  private alertService = inject(TuiNotificationService);
  private readonly destroy$ = new Subject<void>();

  protected readonly windows = DEMAND_WINDOWS;
  protected days = 30;
  protected tab: DemandTab = 'wanted';
  protected demand: Demand | null = null;
  protected loading = false;
  protected error = '';
  /** The wanted row being started or declined, by key. */
  protected deciding: string | null = null;

  /** The no-match query whose catalogue picker is open under it. */
  protected linkingQuery: string | null = null;
  protected pickerQuery = new FormControl('', {nonNullable: true});
  protected pickerHits: CatalogHit[] = [];
  protected aliasing: string | null = null;

  ngOnInit(): void {
    this.load();
    this.pickerQuery.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => isCatalogQuery(query.trim())
        ? this.catalogService.search(query.trim(), 10).pipe(catchError(() => of([] as CatalogHit[])))
        : of([] as CatalogHit[])),
      takeUntil(this.destroy$),
    ).subscribe(hits => this.pickerHits = hits);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private notify(message: string, appearance: 'positive' | 'negative'): void {
    this.alertService.open(message, {appearance}).subscribe();
  }

  protected load(): void {
    this.loading = true;
    this.error = '';
    this.demandService.demand(this.days)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: demand => this.demand = demand,
        error: error => {
          this.demand = null;
          this.error = getErrorMessage(error, 'The demand could not be loaded');
        },
      });
  }

  protected setDays(days: number): void {
    if (this.days === days) return;
    this.days = days;
    this.load();
  }

  protected setTab(tab: DemandTab): void {
    this.tab = tab;
  }

  protected workMeta(row: {author: string | null; year: number | null}): string {
    return demandWorkMeta(row);
  }

  protected catalogMeta(hit: CatalogHit): string {
    return catalogMeta(hit);
  }

  protected wantedKey(row: DemandWantedRow): string {
    return `${row.catalogWorkId}:${row.language}`;
  }

  // --- Wanted ---

  /** Start: the editorial catalogue opens prefilled in a new tab, and the row moves to Being prepared. */
  protected onStart(row: DemandWantedRow): void {
    if (this.deciding) return;
    this.recentAuthGuardService.guardAction(() => this.performStart(row), false, row.workSlug ? 'Add edition' : 'New work');
  }

  private performStart(row: DemandWantedRow): void {
    // Opened before the request so the browser still counts it as the operator's click.
    window.open(row.editorialUrl, '_blank', 'noopener');
    this.decide(row, 'start');
  }

  protected onDecline(row: DemandWantedRow): void {
    if (this.deciding) return;
    this.recentAuthGuardService.guardAction(() => this.decide(row, 'decline'), false, 'Decline');
  }

  private decide(row: DemandWantedRow, decision: 'start' | 'decline'): void {
    this.deciding = this.wantedKey(row);
    const call = decision === 'start' ? this.demandService.start(row) : this.demandService.decline(row);
    call.pipe(finalize(() => this.deciding = null)).subscribe({
      next: () => {
        if (decision === 'decline') this.notify(`Declined ${row.title} in ${row.language.toLowerCase()}.`, 'positive');
        this.load();
      },
      error: error => this.notify(getErrorMessage(error, `Failed to ${decision} the row`), 'negative'),
    });
  }

  // --- No match ---

  protected onOpenPicker(row: DemandNoMatchRow): void {
    if (this.linkingQuery === row.query) {
      this.linkingQuery = null;
      return;
    }
    this.linkingQuery = row.query;
    this.pickerHits = [];
    this.pickerQuery.setValue(row.query);
  }

  protected onAlias(row: DemandNoMatchRow, hit: CatalogHit): void {
    if (this.aliasing) return;
    this.recentAuthGuardService.guardAction(() => this.performAlias(row, hit), false, 'Link');
  }

  private performAlias(row: DemandNoMatchRow, hit: CatalogHit): void {
    this.aliasing = hit.id;
    this.demandService.alias(row.query, hit.id)
      .pipe(finalize(() => this.aliasing = null))
      .subscribe({
        next: () => {
          this.notify(`Search now finds ${hit.title} for “${row.query}”.`, 'positive');
          this.linkingQuery = null;
          this.load();
        },
        error: error => this.notify(getErrorMessage(error, 'Failed to link the query'), 'negative'),
      });
  }
}
