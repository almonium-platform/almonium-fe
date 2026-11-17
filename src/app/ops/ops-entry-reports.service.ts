import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';
import {EntryReportReason} from '../sections/discover/report/entry-report.service';

/** One report in a group, newest first. */
export interface EntryReportItem {
  comment: string | null;
  context: string | null;
  book: string | null;
  entryVersion: number;
  createdAt: string;
}

/**
 * The open reports of one reason on one sense, or on the whole word when `senseKey` is null. `definition` is the
 * sense as it reads now, null when a rewrite dropped it; `entryVersion` the newest version reported against and
 * `currentVersion` the one live now, so a report already rewritten past shows as such.
 */
export interface EntryReportGroup {
  language: string;
  headword: string;
  senseKey: string | null;
  definition: string | null;
  reason: EntryReportReason;
  reports: number;
  reporters: number;
  zipf: number | null;
  entryVersion: number;
  currentVersion: number;
  firstAt: string;
  lastAt: string;
  items: EntryReportItem[];
}

/** /ops → Reports: what readers flagged in the dictionary, the most common word first. */
@Injectable({providedIn: 'root'})
export class OpsEntryReportsService {
  private http = inject(HttpClient);

  queue(): Observable<EntryReportGroup[]> {
    return this.http.get<EntryReportGroup[]>(`${AppConstants.OPS_URL}/lexicon/reports`, {withCredentials: true});
  }

  resolve(group: Pick<EntryReportGroup, 'language' | 'headword' | 'senseKey' | 'reason'>): Observable<{resolved: number}> {
    const {language, headword, senseKey, reason} = group;
    return this.http.post<{resolved: number}>(`${AppConstants.OPS_URL}/lexicon/reports/resolve`,
      {language, headword, senseKey, reason}, {withCredentials: true});
  }
}
