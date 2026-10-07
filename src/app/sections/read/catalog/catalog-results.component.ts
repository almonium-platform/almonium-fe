import {Component, EventEmitter, Input, OnDestroy, Output, TemplateRef, ViewChild, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {BehaviorSubject, Subject, combineLatest, of} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil} from 'rxjs/operators';
import {LanguageCode} from '../../../models/language.enum';
import {getErrorMessage, httpStatus} from '../../../shared/http-error';
import {logger} from '../../../shared/logger';
import {readersLabel, wantedToastMessage} from '../wanted/wanted.model';
import {WantedService} from '../wanted/wanted.service';
import {CatalogHit, CatalogResultsPlan, catalogMeta, isCatalogQuery, planCatalogResults} from './catalog.model';
import {CatalogService} from './catalog.service';

/** Rows shown before "Show N more". */
export const CATALOG_PREVIEW_ROWS = 5;
/** How long the shelf search waits for the reader to stop typing before it asks the catalogue. */
export const CATALOG_DEBOUNCE_MS = 300;
/** Hits the shelf asks the catalogue for. */
export const CATALOG_LIMIT = 20;

const EMPTY_PLAN: CatalogResultsPlan = {copyright: null, rows: []};

/**
 * Under the shelf, while the reader searches (W1, W2): every notable book the shelf does not have yet, as rows
 * rather than tiles, each with the one thing the reader can do about it. Nothing here is a cover; nothing is a
 * lock. A book under copyright is said plainly once, with the private import as the way to read it anyway.
 */
@Component({
  selector: 'app-catalog-results',
  imports: [RouterLink],
  templateUrl: './catalog-results.component.html',
  styleUrl: './catalog-results.component.less',
})
export class CatalogResultsComponent implements OnDestroy {
  private catalogService = inject(CatalogService);
  private wantedService = inject(WantedService);
  private alertService = inject(TuiNotificationService);

  /** The shelf's search text as typed; the component debounces it and drops answers to older queries. */
  @Input() set query(value: string | null) {
    this.query$.next((value ?? '').trim());
  }

  /** The shelf's language: the search counts readers in it, and a want asks for the book in it. */
  @Input() set language(value: LanguageCode | null) {
    this.language$.next(value);
  }

  get language(): LanguageCode | null {
    return this.language$.value;
  }

  @Input() authenticated = false;
  /** "Import your copy": the shelf decides where that goes (sign up, the paywall, or the import sheet). */
  @Output() readonly importRequested = new EventEmitter<void>();

  /** The W4 toast: the place in line, and the way to the queue. */
  @ViewChild('wantedToast', {static: true}) private wantedToast!: TemplateRef<unknown>;

  protected plan: CatalogResultsPlan = EMPTY_PLAN;
  protected expanded = false;
  /** Hits this reader wants in the shelf's language, by catalogue id; seeded from the search, kept by the toggles. */
  protected readonly wanted = new Set<string>();
  /** Reader counts the answer to a want or a withdrawal brought, newer than the search's. */
  private readonly readers = new Map<string, number | null>();
  protected busy: string | null = null;
  /** The guest's row that asked them to sign in first. */
  protected signInFor: string | null = null;
  /** The server's reason a want was refused (409), under the row it belongs to. */
  protected refusal: {id: string; message: string} | null = null;

  private readonly query$ = new BehaviorSubject<string>('');
  private readonly language$ = new BehaviorSubject<LanguageCode | null>(null);
  private readonly destroy$ = new Subject<void>();

  constructor() {
    combineLatest([this.query$, this.language$]).pipe(
      debounceTime(CATALOG_DEBOUNCE_MS),
      distinctUntilChanged(([queryA, languageA], [queryB, languageB]) => queryA === queryB && languageA === languageB),
      switchMap(([query, language]) => isCatalogQuery(query)
        ? this.catalogService.search(query, CATALOG_LIMIT, language).pipe(
          catchError(error => {
            logger.warn('The catalogue search failed; the shelf stands alone.', error);
            return of([] as CatalogHit[]);
          }),
        )
        : of([] as CatalogHit[])),
      takeUntil(this.destroy$),
    ).subscribe(hits => {
      const plan = hits.length > 0 ? planCatalogResults(hits) : EMPTY_PLAN;
      this.plan = plan;
      this.expanded = false;
      this.signInFor = null;
      this.refusal = null;
      this.readers.clear();
      this.wanted.clear();
      plan.rows.filter(hit => hit.wantedByMe).forEach(hit => this.wanted.add(hit.id));
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected get visibleRows(): CatalogHit[] {
    return this.expanded ? this.plan.rows : this.plan.rows.slice(0, CATALOG_PREVIEW_ROWS);
  }

  protected get hiddenCount(): number {
    return this.plan.rows.length - this.visibleRows.length;
  }

  protected get hasResults(): boolean {
    return this.plan.copyright !== null || this.plan.rows.length > 0;
  }

  protected meta(hit: CatalogHit): string {
    return catalogMeta(hit);
  }

  /** "N readers" beside the button, once three or more want it. */
  protected readersLabel(hit: CatalogHit): string | null {
    return readersLabel(this.readerCount(hit));
  }

  private readerCount(hit: CatalogHit): number | null {
    return this.readers.has(hit.id) ? this.readers.get(hit.id) ?? null : hit.readers;
  }

  /** "I want this", and "✓ Wanted" tapped again takes the want back. */
  protected toggle(hit: CatalogHit): void {
    if (!this.authenticated) {
      this.signInFor = hit.id;
      return;
    }
    const language = this.language;
    if (!language || this.busy) return;
    this.refusal = null;
    if (this.wanted.has(hit.id)) {
      this.withdraw(hit, language);
    } else {
      this.want(hit, language);
    }
  }

  private want(hit: CatalogHit, language: LanguageCode): void {
    this.busy = hit.id;
    this.wantedService.want(hit.id, language).pipe(finalize(() => this.busy = null)).subscribe({
      next: receipt => {
        this.wanted.add(hit.id);
        this.readers.set(hit.id, receipt.readers);
        this.alertService.open(this.wantedToast, {appearance: 'positive', data: wantedToastMessage(receipt.rank)}).subscribe();
      },
      error: error => {
        if (httpStatus(error) === 409) {
          this.refusal = {id: hit.id, message: getErrorMessage(error, $localize`We can’t take a want for this one.`)};
          return;
        }
        this.alertService.open(getErrorMessage(error, $localize`Couldn’t add it to Wanted`), {appearance: 'negative'}).subscribe();
      },
    });
  }

  /** Silent: the row simply turns back into "I want this". */
  private withdraw(hit: CatalogHit, language: LanguageCode): void {
    this.busy = hit.id;
    this.wantedService.withdraw(hit.id, language).pipe(finalize(() => this.busy = null)).subscribe({
      next: () => {
        this.wanted.delete(hit.id);
        // The count included this reader; below three the server would hide it, so the row does too.
        const count = this.readerCount(hit);
        this.readers.set(hit.id, count !== null && count - 1 >= 3 ? count - 1 : null);
      },
      error: error => this.alertService.open(getErrorMessage(error, $localize`Couldn’t take it off Wanted`), {appearance: 'negative'}).subscribe(),
    });
  }
}
