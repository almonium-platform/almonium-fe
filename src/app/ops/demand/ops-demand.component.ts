import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {LowerCasePipe} from '@angular/common';
import {FormControl, ReactiveFormsModule} from '@angular/forms';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {Subject, of} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil} from 'rxjs/operators';
import {RecentAuthGuardService} from '../../authentication/auth/recent-auth-guard.service';
import {getErrorMessage, httpStatus} from '../../shared/http-error';
import {CatalogHit, catalogMeta, isCatalogQuery} from '../../sections/read/catalog/catalog.model';
import {CatalogService} from '../../sections/read/catalog/catalog.service';
import {StageState, stageStates} from '../../sections/read/wanted/wanted.model';
import {
  Demand,
  DemandNoMatchRow,
  DemandPreparing,
  DemandWantedRow,
  OpsDemandService,
  TextSource,
  demandWorkMeta,
  sourceBlockedReason,
  sourceTranslationLine,
} from '../ops-demand.service';

export type DemandTab = 'wanted' | 'underCopyright' | 'noMatch';
export const DEMAND_WINDOWS = [7, 30, 90] as const;
/** The Wanted page's four stages, as /ops names them. */
export const PREPARATION_STAGES = ['Text', 'Chapters', 'Level & words', 'On the shelf'] as const;
const SOURCE_KIND_LABELS: Record<string, string> = {GUTENBERG: 'Gutenberg', WIKISOURCE: 'Wikisource'};
const SOURCE_STATUS_LABELS: Record<string, string> = {FREE: 'free', UNKNOWN: 'unknown', PROTECTED: 'under copyright'};

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

  /** The wanted row whose source picker is open under it, by key. */
  protected pickingFor: string | null = null;
  /** The work's text sources, free first; null while they load. */
  protected sources: TextSource[] | null = null;
  protected sourcesError = '';
  protected chosenSource: string | null = null;
  /** The server's reason a start was refused (409), inside the picker. */
  protected startError = '';

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

  /**
   * Start opens the source picker under the row: the work's free texts, one of which the book processor can fetch and
   * ingest, or "Start without a text", which opens the editorial catalogue prefilled as before.
   */
  protected onStart(row: DemandWantedRow): void {
    const key = this.wantedKey(row);
    if (this.pickingFor === key) {
      this.closePicker();
      return;
    }
    this.pickingFor = key;
    this.sources = null;
    this.sourcesError = '';
    this.chosenSource = null;
    this.startError = '';
    this.demandService.sources(row.catalogWorkId).subscribe({
      next: sources => {
        if (this.pickingFor !== key) return;
        this.sources = sources;
        this.chosenSource = (previousSource(sources, row.preparing) ?? preferredSource(sources, row.language))?.id ?? null;
      },
      error: error => {
        if (this.pickingFor !== key) return;
        this.sources = [];
        this.sourcesError = getErrorMessage(error, 'The sources could not be loaded');
      },
    });
  }

  protected closePicker(): void {
    this.pickingFor = null;
    this.sources = null;
    this.chosenSource = null;
    this.startError = '';
  }

  protected chooseSource(source: TextSource): void {
    if (this.blockedReason(source)) return;
    this.chosenSource = source.id;
    this.startError = '';
  }

  /** Start with the chosen text: the processor fetches it, and the row moves to Being prepared. */
  protected onStartWithSource(row: DemandWantedRow): void {
    const sourceId = this.chosenSource;
    if (this.deciding || !sourceId) return;
    this.recentAuthGuardService.guardAction(() => this.performStartWithSource(row, sourceId), false, 'Start with this text');
  }

  private performStartWithSource(row: DemandWantedRow, sourceId: string): void {
    this.deciding = this.wantedKey(row);
    this.startError = '';
    this.demandService.start(row, sourceId).pipe(finalize(() => this.deciding = null)).subscribe({
      next: () => {
        const source = this.sources?.find(item => item.id === sourceId);
        this.notify(`Preparing ${row.title} from ${source ? this.sourceKind(source.kind) : 'the chosen text'}.`, 'positive');
        this.closePicker();
        this.load();
      },
      error: error => {
        if (httpStatus(error) === 409) {
          this.startError = getErrorMessage(error, 'The book processor can’t start this one.');
          return;
        }
        this.notify(getErrorMessage(error, 'Failed to start the row'), 'negative');
      },
    });
  }

  /** Start without a text: the editorial catalogue opens prefilled in a new tab, and the row moves to Being prepared. */
  protected onStartWithoutSource(row: DemandWantedRow): void {
    if (this.deciding) return;
    this.recentAuthGuardService.guardAction(() => this.performStart(row), false, row.workSlug ? 'Add edition' : 'New work');
  }

  private performStart(row: DemandWantedRow): void {
    // Opened before the request so the browser still counts it as the operator's click.
    window.open(row.editorialUrl, '_blank', 'noopener');
    this.closePicker();
    this.decide(row, 'start');
  }

  protected sourceKind(kind: string): string {
    return SOURCE_KIND_LABELS[kind] ?? kind.toLowerCase();
  }

  protected sourceStatus(source: TextSource): string {
    return SOURCE_STATUS_LABELS[source.status] ?? source.status.toLowerCase();
  }

  protected translationLine(source: TextSource): string {
    return sourceTranslationLine(source);
  }

  protected blockedReason(source: TextSource): string | null {
    return sourceBlockedReason(source);
  }

  /** The four stages of a preparation, as the ops phase chips: done, under way (unless it failed), still to come. */
  protected preparationStages(preparing: DemandPreparing): {label: string; state: StageState}[] {
    return stageStates(preparing.stagesDone).map((state, index) => ({
      label: PREPARATION_STAGES[index],
      state: state === 'current' && this.preparationFailed(preparing) ? 'todo' : state,
    }));
  }

  protected preparationFailed(preparing: DemandPreparing): boolean {
    return preparing.phase === 'failed' || (!!preparing.error && preparing.phase !== 'published');
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

/** The text a picker opens on: the first one that can be chosen in the language readers want, if any. */
export function preferredSource(sources: readonly TextSource[], language: string): TextSource | null {
  const wanted = language.toLowerCase();
  return sources.find(source => source.status !== 'PROTECTED' && source.language.toLowerCase() === wanted) ?? null;
}

/** On a retry, the text the failed preparation used, while it is still listed and can still be chosen. */
export function previousSource(sources: readonly TextSource[], preparing: DemandPreparing | null): TextSource | null {
  if (!preparing) return null;
  return sources.find(source => source.status !== 'PROTECTED' && source.pageUrl === preparing.sourceUrl) ?? null;
}
