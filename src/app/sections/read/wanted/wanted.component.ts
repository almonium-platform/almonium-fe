import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {EMPTY, Subject} from 'rxjs';
import {catchError, finalize, switchMap, takeUntil} from 'rxjs/operators';
import {LanguageNameService} from '../../../services/language-name.service';
import {getErrorMessage, httpStatus} from '../../../shared/http-error';
import {bookColor, hashedBookHue} from '../book-hue';
import {ArrivedRow, WantedQueue, WantedRow, readersLabel} from './wanted.model';
import {WantedService} from './wanted.service';

export type WantedView = 'everyone' | 'mine';

/**
 * The Wanted page (W3): what is being prepared, the public queue ranked by readers, and what arrived lately. It
 * says order and state only, never a date: the rank is a strong hint to editorial, not a promise.
 */
@Component({
  selector: 'app-wanted',
  imports: [RouterLink],
  templateUrl: './wanted.component.html',
  styleUrl: './wanted.component.less',
})
export class WantedComponent implements OnInit, OnDestroy {
  private wantedService = inject(WantedService);
  private languageNameService = inject(LanguageNameService);
  private alertService = inject(TuiNotificationService);

  protected view: WantedView = 'everyone';
  protected wanted: WantedQueue | null = null;
  protected loading = false;
  protected loadError = false;
  /** The row whose want is on its way to the server. */
  protected busy: string | null = null;
  /** The server's reason a want was refused (409), under its row. */
  protected refusal: {key: string; message: string} | null = null;

  private readonly load$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.load$.pipe(
      switchMap(() => {
        this.loading = true;
        this.loadError = false;
        return this.wantedService.queue(this.view === 'mine').pipe(
          catchError(() => {
            this.loadError = true;
            return EMPTY;
          }),
          finalize(() => this.loading = false),
        );
      }),
      takeUntil(this.destroy$),
    ).subscribe(wanted => this.wanted = wanted);
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected reload(): void {
    this.load$.next();
  }

  protected setView(view: WantedView): void {
    if (this.view === view) return;
    this.view = view;
    this.refusal = null;
    this.reload();
  }

  protected get mineCount(): number {
    return this.wanted?.mineCount ?? 0;
  }

  protected get isEmpty(): boolean {
    return !!this.wanted && this.wanted.beingPrepared.length === 0 && this.wanted.queue.length === 0;
  }

  protected key(row: Pick<WantedRow, 'catalogWorkId' | 'language'>): string {
    return `${row.catalogWorkId}:${row.language}`;
  }

  protected languageName(code: string): string {
    return this.languageNameService.getLanguageName(code);
  }

  /** "author · Language"; "author · Polish edition" when the shelf has the work in another language already. */
  protected rowMeta(row: WantedRow): string {
    const language = this.languageName(row.language);
    const where = row.workSlug ? $localize`${language}:language: edition` : language;
    return [row.author, where].filter(Boolean).join(' · ');
  }

  protected arrivedMeta(row: ArrivedRow): string {
    return [row.author, this.languageName(row.language), row.cefrLevel].filter(Boolean).join(' · ');
  }

  protected readersLabel(row: WantedRow): string | null {
    return readersLabel(row.readers);
  }

  protected coverColor(row: ArrivedRow): string {
    return bookColor(hashedBookHue(row.editionSlug));
  }

  /** "I want this" and "✓ Wanted" as on the search rows; the queue reloads, since rank and readers move with it. */
  protected toggle(row: WantedRow): void {
    if (this.busy) return;
    const key = this.key(row);
    this.busy = key;
    this.refusal = null;
    const call = row.wantedByMe
      ? this.wantedService.withdraw(row.catalogWorkId, row.language)
      : this.wantedService.want(row.catalogWorkId, row.language);
    call.pipe(finalize(() => this.busy = null)).subscribe({
      next: () => this.reload(),
      error: error => {
        if (httpStatus(error) === 409) {
          this.refusal = {key, message: getErrorMessage(error, $localize`We can’t take a want for this one.`)};
          return;
        }
        const fallback = row.wantedByMe ? $localize`Couldn’t take it off Wanted` : $localize`Couldn’t add it to Wanted`;
        this.alertService.open(getErrorMessage(error, fallback), {appearance: 'negative'}).subscribe();
      },
    });
  }
}
