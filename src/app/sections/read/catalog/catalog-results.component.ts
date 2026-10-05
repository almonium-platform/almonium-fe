import {Component, EventEmitter, Input, OnDestroy, Output, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {Subject, of} from 'rxjs';
import {catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap, takeUntil} from 'rxjs/operators';
import {LanguageCode} from '../../../models/language.enum';
import {getErrorMessage, httpStatus} from '../../../shared/http-error';
import {logger} from '../../../shared/logger';
import {ReadService} from '../read.service';
import {CatalogHit, CatalogResultsPlan, catalogMeta, isCatalogQuery, planCatalogResults} from './catalog.model';
import {CatalogService} from './catalog.service';

/** Rows shown before "Show N more". */
export const CATALOG_PREVIEW_ROWS = 5;
/** How long the shelf search waits for the reader to stop typing before it asks the catalogue. */
export const CATALOG_DEBOUNCE_MS = 300;

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
  private readService = inject(ReadService);
  private alertService = inject(TuiNotificationService);

  /** The shelf's search text as typed; the component debounces it and drops answers to older queries. */
  @Input() set query(value: string | null) {
    this.query$.next((value ?? '').trim());
  }

  /** The shelf's language: a want asks for the book in it. */
  @Input() language: LanguageCode | null = null;
  @Input() authenticated = false;
  /** "Import your copy": the shelf decides where that goes (sign up, the paywall, or the import sheet). */
  @Output() readonly importRequested = new EventEmitter<void>();

  protected plan: CatalogResultsPlan = EMPTY_PLAN;
  protected expanded = false;
  /** Hits this reader wants, by catalogue id; a 409 means they had asked already, which is the same thing. */
  protected readonly wanted = new Set<string>();
  protected wanting: string | null = null;
  /** The guest's row that asked them to sign in first. */
  protected signInFor: string | null = null;

  private readonly query$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor() {
    this.query$.pipe(
      debounceTime(CATALOG_DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap(query => isCatalogQuery(query)
        ? this.catalogService.search(query).pipe(
          map(planCatalogResults),
          catchError(error => {
            logger.warn('The catalogue search failed; the shelf stands alone.', error);
            return of(EMPTY_PLAN);
          }),
        )
        : of(EMPTY_PLAN)),
      takeUntil(this.destroy$),
    ).subscribe(plan => {
      this.plan = plan;
      this.expanded = false;
      this.signInFor = null;
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

  /** "I want this" is the ask-for-a-book flow (G19) with the catalogue's spelling of the title and author. */
  protected want(hit: CatalogHit): void {
    if (!this.authenticated) {
      this.signInFor = hit.id;
      return;
    }
    const language = this.language;
    if (!language || this.wanting || this.wanted.has(hit.id)) return;
    this.wanting = hit.id;
    this.readService.askForBook({
      title: hit.title,
      author: hit.author ?? '',
      language,
      ...(hit.workSlug ? {workSlug: hit.workSlug} : {}),
    }).pipe(finalize(() => this.wanting = null)).subscribe({
      next: () => this.wanted.add(hit.id),
      error: error => {
        if (httpStatus(error) === 409) {
          this.wanted.add(hit.id);
          return;
        }
        this.alertService.open(getErrorMessage(error, $localize`Couldn’t send the ask`), {appearance: 'negative'}).subscribe();
      },
    });
  }
}
