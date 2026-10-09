import {Component, Input, OnDestroy, OnInit, inject} from '@angular/core';
import {BehaviorSubject, Subject, of} from 'rxjs';
import {catchError, switchMap, takeUntil} from 'rxjs/operators';
import {LanguageCode} from '../../../models/language.enum';
import {logger} from '../../../shared/logger';
import {readersLabel} from '../wanted/wanted.model';
import {CatalogHit, catalogMeta} from './catalog.model';
import {CatalogService} from './catalog.service';
import {FreeFromNoteComponent} from './free-from-note.component';
import {FreeFromNote, copyrightCountdown, nextPublicDomainYear} from './public-domain-day';

/** Works the Public Domain Day shelf asks for. */
export const COMING_FREE_LIMIT = 12;

/**
 * Public Domain Day: the best-known works that become free next 1 January, counted down to the day. They cannot be
 * wanted yet, so a row has no button, only the day it frees up. One compact section, absent when the list is empty
 * or the catalogue does not answer.
 */
@Component({
  selector: 'app-coming-free',
  imports: [FreeFromNoteComponent],
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

  protected readonly year = nextPublicDomainYear(new Date());
  protected hits: CatalogHit[] = [];
  protected expanded = false;

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
    ).subscribe(hits => this.hits = hits);
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
