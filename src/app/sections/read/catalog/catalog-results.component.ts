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
import {CatalogHit, CatalogResultsPlan, SourceOption, catalogMeta, isCatalogQuery, planCatalogResults, sourceLibraryName} from './catalog.model';
import {CatalogService} from './catalog.service';
import {FreeFromNoteComponent} from './free-from-note.component';
import {FreeFromNote, ReaderFreeNote, copyrightCountdown, countryName, freeSinceNote, readerFreeNote} from './public-domain-day';
import {UnlockCountdownComponent} from './unlock-countdown.component';
import {UnlockMapComponent} from './unlock-map.component';

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
/** "French" for "fr", in the page's language; the code itself when the browser does not know it. */
function languageLabel(code: string): string {
  try {
    return new Intl.DisplayNames([document.documentElement.lang || 'en'], {type: 'language'}).of(code) ?? code;
  } catch {
    return code;
  }
}

@Component({
  selector: 'app-catalog-results',
  imports: [RouterLink, FreeFromNoteComponent, UnlockCountdownComponent, UnlockMapComponent],
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
  /** "Where it's free" on the countdown card (W6) opens the map (W7) under it. */
  protected mapOpen = false;
  /** Hits this reader wants in the shelf's language, by catalogue id; seeded from the search, kept by the toggles. */
  protected readonly wanted = new Set<string>();
  /** Reader counts the answer to a want or a withdrawal brought, newer than the search's. */
  private readonly readers = new Map<string, number | null>();
  protected busy: string | null = null;
  /** The guest's row that asked them to sign in first. */
  protected signInFor: string | null = null;
  /** The server's reason a want was refused (409), under the row it belongs to. */
  protected refusal: {id: string; message: string} | null = null;
  /** Each row's libraries, best first, once the catalogue has answered for it (W1). */
  protected readonly sources = new Map<string, SourceOption[]>();
  /** The row whose other editions are unfolded. */
  protected editionsOpen: string | null = null;

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
      this.mapOpen = false;
      this.signInFor = null;
      this.refusal = null;
      this.readers.clear();
      this.wanted.clear();
      this.sources.clear();
      this.editionsOpen = null;
      [...plan.rows, ...(plan.copyright ? [plan.copyright] : [])].filter(hit => hit.wantedByMe).forEach(hit => this.wanted.add(hit.id));
      plan.rows.forEach(hit => this.loadSources(hit));
    });
  }

  /** Which library's text the book would be made from, so the reader can see it and pick another. */
  private loadSources(hit: CatalogHit): void {
    this.catalogService.sources(hit.id).pipe(
      catchError(error => {
        logger.warn('The catalogue did not say where a book would come from.', error);
        return of([] as SourceOption[]);
      }),
      takeUntil(this.destroy$),
    ).subscribe(options => {
      if (this.plan.rows.some(row => row.id === hit.id)) this.sources.set(hit.id, options);
    });
  }

  /** The library the catalogue would take the text from. */
  protected defaultSource(hit: CatalogHit): SourceOption | null {
    return this.sources.get(hit.id)?.find(option => option.preferred) ?? null;
  }

  /** The other free texts a reader may choose instead; protected ones are not offered. */
  protected otherSources(hit: CatalogHit): SourceOption[] {
    return (this.sources.get(hit.id) ?? []).filter(option => !option.preferred && option.status === 'FREE');
  }

  protected libraryName(kind: string): string {
    return sourceLibraryName(kind);
  }

  /** "in French", or "translated into French" for a text that is not in the work's language. */
  protected sourceNote(hit: CatalogHit, option: SourceOption): string {
    const language = option.language ? languageLabel(option.language) : '';
    if (!language) return '';
    return option.translation ? $localize`translated into ${language}:language:` : $localize`in ${language}:language:`;
  }

  /** Choosing a text is wanting the book from it. */
  protected choose(hit: CatalogHit, option: SourceOption): void {
    if (!this.authenticated) {
      this.signInFor = hit.id;
      return;
    }
    const language = this.language;
    if (!language || this.busy) return;
    this.editionsOpen = null;
    this.refusal = null;
    this.want(hit, language, option.downloadUrl);
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

  /** When the protected best hit frees up, if the catalogue knows the exact year. */
  protected countdown(hit: CatalogHit): FreeFromNote | null {
    return copyrightCountdown(hit.freeFrom, new Date());
  }

  /**
   * The day the reader can open the protected best hit (W6): the card counts down to it, or names it, and the work
   * can be wanted ahead of the day. Null when the server could not pin the year, and the card stays plain (W2).
   */
  protected unlock(hit: CatalogHit): ReaderFreeNote | null {
    return readerFreeNote(hit.readerFreeFrom, new Date());
  }

  /** "Under copyright in Germany" when the server placed the reader; "Under copyright" otherwise. */
  protected copyrightChip(hit: CatalogHit): string {
    return hit.readerCountry ? $localize`Under copyright in ${countryName(hit.readerCountry)}:country:` : $localize`Under copyright`;
  }

  /** "Free since 1 January" on a row that turned free this year. */
  protected freeSince(hit: CatalogHit): FreeFromNote | null {
    return freeSinceNote(hit.freeFrom, new Date());
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

  private want(hit: CatalogHit, language: LanguageCode, sourceDownloadUrl: string | null = null): void {
    this.busy = hit.id;
    const request = sourceDownloadUrl ? this.wantedService.want(hit.id, language, sourceDownloadUrl) : this.wantedService.want(hit.id, language);
    request.pipe(finalize(() => this.busy = null)).subscribe({
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
