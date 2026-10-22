import {Component, Input, OnDestroy, OnInit, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {BehaviorSubject, Subject, of} from 'rxjs';
import {catchError, finalize, switchMap, takeUntil} from 'rxjs/operators';
import {LanguageCode} from '../../../models/language.enum';
import {logger} from '../../../shared/logger';
import {readersLabel} from '../wanted/wanted.model';
import {WantedService} from '../wanted/wanted.service';
import {CatalogHit, catalogMeta} from './catalog.model';
import {CatalogService} from './catalog.service';
import {FreeFromNoteComponent} from './free-from-note.component';
import {FreeFromNote, copyrightCountdown, countryName, inArrivalSeason, inUnlockSeason, nextPublicDomainYear} from './public-domain-day';

/** Works the Public Domain Day shelf asks for. */
export const COMING_FREE_LIMIT = 12;
/** On the shelf the rail waits for this many works lined up for the reader's country. */
export const SHELF_MIN_ROWS = 3;

/**
 * Public Domain Day (W8): the best-known works that become free next 1 January where the reader is, counted down to
 * the day, each with "Tell me", a want with a date attached. On the shelf the rail shows from October to December,
 * once three works are lined up; through January it reads "New this year" and a work that arrived has a Read link.
 * The Wanted page shows it all year. Absent when the list is empty or the catalogue does not answer.
 */
@Component({
  selector: 'app-coming-free',
  imports: [FreeFromNoteComponent, RouterLink],
  templateUrl: './coming-free.component.html',
  styleUrl: './coming-free.component.less',
})
export class ComingFreeComponent implements OnInit, OnDestroy {
  private catalogService = inject(CatalogService);

  /** Counts readers in this language when given; the Wanted page spans every language and sends none. */
  @Input() set language(value: LanguageCode | null) {
    this.language$.next(value);
  }

  /** Rows shown before "Show N more"; null shows them all. */
  @Input() preview: number | null = null;

  /** On the shelf: only in season (October to January), and only with three works lined up. */
  @Input() seasonal = false;

  /** A member can tap "Tell me"; a guest is sent to sign in. */
  @Input() authenticated = false;

  /** The clock; tests set it. */
  now: () => Date = () => new Date();

  protected readonly year = nextPublicDomainYear(new Date());
  protected hits: CatalogHit[] = [];
  protected expanded = false;
  /** Rows this reader wants in the shelf's language, by catalogue id. */
  protected readonly wanted = new Set<string>();
  protected busy: string | null = null;
  protected signInFor: string | null = null;

  private wantedService = inject(WantedService);
  private readonly language$ = new BehaviorSubject<LanguageCode | null>(null);
  private readonly destroy$ = new Subject<void>();

  /** Subscribed once the first inputs are in, so the shelf's language is not preceded by a request without one. */
  ngOnInit(): void {
    this.language$.pipe(
      switchMap(language => this.catalogService.comingFree(this.year, COMING_FREE_LIMIT, language).pipe(
        catchError(error => {
          logger.warn('The coming-free list did not load; the section stays away.', error);
          return of([] as CatalogHit[]);
        }),
      )),
      takeUntil(this.destroy$),
    ).subscribe(hits => {
      this.hits = hits;
      this.wanted.clear();
      hits.filter(hit => hit.wantedByMe).forEach(hit => this.wanted.add(hit.id));
    });
  }

  /** Whether the rail stands at all: out of season or thin on the shelf, it stays away. */
  protected get shown(): boolean {
    if (this.hits.length === 0) return false;
    if (!this.seasonal) return true;
    const today = this.now();
    return (inUnlockSeason(today) || inArrivalSeason(today)) && this.hits.length >= SHELF_MIN_ROWS;
  }

  /** Through January the works have arrived: the rail is this year's, not next year's. */
  protected get arrived(): boolean {
    return inArrivalSeason(this.now());
  }

  /** The reader's country as the server placed them, named in their language; null when it did not say. */
  protected get country(): string | null {
    const code = this.hits.find(hit => hit.readerCountry)?.readerCountry ?? null;
    return code ? countryName(code) : null;
  }

  /** "Tell me" asks for the work on the day; tapped again it takes the want back. */
  protected toggle(hit: CatalogHit): void {
    if (!this.authenticated) {
      this.signInFor = hit.id;
      return;
    }
    const language = this.language$.value;
    if (!language || this.busy) return;
    this.busy = hit.id;
    const had = this.wanted.has(hit.id);
    const call = had ? this.wantedService.withdraw(hit.id, language) : this.wantedService.want(hit.id, language);
    call.pipe(finalize(() => this.busy = null)).subscribe({
      next: () => had ? this.wanted.delete(hit.id) : this.wanted.add(hit.id),
      error: error => logger.warn('The want did not go through.', error),
    });
  }

  protected get canWant(): boolean {
    return this.language$.value !== null && !this.arrived;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** The heading's chip: next 1 January, from the reader's calendar. */
  protected get countdown(): FreeFromNote | null {
    return copyrightCountdown(this.year, new Date());
  }

  protected rowCountdown(hit: CatalogHit): FreeFromNote | null {
    return copyrightCountdown(hit.freeFrom ?? this.year, new Date());
  }

  protected get visibleHits(): CatalogHit[] {
    return this.expanded || this.preview === null ? this.hits : this.hits.slice(0, this.preview);
  }

  protected get hiddenCount(): number {
    return this.hits.length - this.visibleHits.length;
  }

  protected meta(hit: CatalogHit): string {
    return catalogMeta(hit);
  }

  protected readersLabel(hit: CatalogHit): string | null {
    return readersLabel(hit.readers);
  }
}
