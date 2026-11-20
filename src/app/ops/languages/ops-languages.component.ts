import {Component, OnInit, inject, ChangeDetectionStrategy} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import {finalize} from 'rxjs/operators';
import {getErrorMessage} from '../../shared/http-error';
import {LanguageLine, LanguagePulse, OpsLanguagesService, lexiconShare} from '../ops-languages.service';

export const LANGUAGE_WINDOWS = [1, 7, 30] as const;

/**
 * /ops → Languages: per language, who learns it, who looked words up in Discover, how much of that the lexicon
 * answered, and the words it lacked. The language with the most lookers and the fewest lexicon answers is the one to
 * warm up next; its misses are the first words to write.
 */
@Component({
  selector: 'app-ops-languages',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './ops-languages.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './ops-languages.component.less',
})
export class OpsLanguagesComponent implements OnInit {
  private languagesService = inject(OpsLanguagesService);

  protected readonly windows = LANGUAGE_WINDOWS;
  protected days = 7;
  protected pulse: LanguagePulse | null = null;
  protected loading = false;
  protected error = '';
  /** The language whose missed words are open under its row. */
  protected open: string | null = null;

  ngOnInit(): void {
    this.load();
  }

  protected setDays(days: number): void {
    if (days === this.days) return;
    this.days = days;
    this.load();
  }

  protected load(): void {
    this.loading = true;
    this.error = '';
    this.languagesService.pulse(this.days)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: pulse => this.pulse = pulse,
        error: error => {
          this.pulse = null;
          this.error = getErrorMessage(error, 'The languages could not be loaded');
        },
      });
  }

  protected toggle(line: LanguageLine): void {
    this.open = this.open === line.language ? null : line.language;
  }

  protected share(line: LanguageLine): number | null {
    return lexiconShare(line);
  }

  protected windowLabel(days: number): string {
    return days === 1 ? '24 hours' : `${days} days`;
  }

  protected name(code: string): string {
    try {
      return new Intl.DisplayNames(['en'], {type: 'language'}).of(code.toLowerCase()) ?? code;
    } catch {
      return code;
    }
  }
}
