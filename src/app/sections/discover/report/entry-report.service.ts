import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../../../app.constants';
import {LanguageCode} from '../../../models/language.enum';

/** What a reader says is wrong with a word or one of its senses, in the backend's spelling. */
export type EntryReportReason = 'WRONG_SENSE' | 'WRONG_DEFINITION' | 'WRONG_GRAMMAR' | 'WRONG_SOUND' | 'BAD_EXAMPLE';

export const ENTRY_REPORT_REASONS: readonly EntryReportReason[] = ['WRONG_SENSE', 'WRONG_DEFINITION', 'WRONG_GRAMMAR', 'WRONG_SOUND', 'BAD_EXAMPLE'];

/**
 * The flag on a word (`senseKey` null) or on one sense. The backend attaches the lexeme and the entry version;
 * the sentence and the book come from where the word was met, so a report needs no comment to be usable.
 */
export interface EntryReport {
  language: LanguageCode;
  headword: string;
  senseKey: string | null;
  reason: EntryReportReason;
  comment: string | null;
  context: string | null;
  book: string | null;
}

@Injectable({providedIn: 'root'})
export class EntryReportService {
  private readonly http = inject(HttpClient);

  report(report: EntryReport): Observable<unknown> {
    return this.http.post(`${AppConstants.API_URL}/lexicon/reports`, report, {withCredentials: true});
  }
}
