import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

export type DemandStatus = 'OPEN' | 'IN_PROGRESS';

/** A work in a language readers want, by distinct readers; Start opens the editorial catalogue prefilled. */
export interface DemandWantedRow {
  catalogWorkId: string;
  title: string;
  author: string | null;
  year: number | null;
  language: string;
  /** Set when the shelf has the work in another language: the row is a new edition, not a new work. */
  workSlug: string | null;
  readers: number;
  status: DemandStatus;
  firstWantedAt: string;
  lastWantedAt: string;
  editorialUrl: string;
}

/** A work under copyright readers searched for: research for a licensing conversation. */
export interface DemandUnderCopyrightRow {
  catalogWorkId: string;
  title: string;
  author: string | null;
  year: number | null;
  originalLanguage: string | null;
  searches: number;
  readers: number;
  publisher: string | null;
  freeFrom: number | null;
}

/** A query that matched nothing; "Link to work" teaches search what it meant. */
export interface DemandNoMatchRow {
  query: string;
  searches: number;
  readers: number;
}

export interface Demand {
  days: number;
  wanted: DemandWantedRow[];
  underCopyright: DemandUnderCopyrightRow[];
  noMatch: DemandNoMatchRow[];
}

/** /ops → Demand (W5): what readers want, what they looked for that is protected, and what found nothing. */
@Injectable({providedIn: 'root'})
export class OpsDemandService {
  private http = inject(HttpClient);
  private readonly demandUrl = `${AppConstants.OPS_URL}/demand`;

  demand(days: number): Observable<Demand> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<Demand>(this.demandUrl, {params, withCredentials: true});
  }

  /** Moves the row to Being prepared on the Wanted page. */
  start(row: Pick<DemandWantedRow, 'catalogWorkId' | 'language'>): Observable<unknown> {
    return this.http.post(`${this.wantedUrl(row)}/start`, {}, {withCredentials: true});
  }

  /** Drops the row from the queue; no mail. */
  decline(row: Pick<DemandWantedRow, 'catalogWorkId' | 'language'>): Observable<unknown> {
    return this.http.post(`${this.wantedUrl(row)}/decline`, {}, {withCredentials: true});
  }

  /** Teaches search that a query which found nothing means this catalogue work. */
  alias(query: string, catalogWorkId: string): Observable<unknown> {
    return this.http.post(`${this.demandUrl}/aliases`, {query, catalogWorkId}, {withCredentials: true});
  }

  private wantedUrl(row: Pick<DemandWantedRow, 'catalogWorkId' | 'language'>): string {
    return `${this.demandUrl}/wanted/${row.catalogWorkId}/${row.language}`;
  }
}

/** "author · year", whichever is known, with the title on the line above. */
export function demandWorkMeta(row: {author: string | null; year: number | null}): string {
  return [row.author, row.year === null ? null : String(row.year)].filter(Boolean).join(' · ') || 'Unknown author';
}
