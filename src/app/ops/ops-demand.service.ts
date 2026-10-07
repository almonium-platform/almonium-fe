import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

export type DemandStatus = 'OPEN' | 'IN_PROGRESS';

/** The free text /ops started preparing a row from: the source, the book processor's phase, and four stages. */
export interface DemandPreparing {
  sourceKind: string;
  /** The source's human page. */
  sourceUrl: string;
  sourceLanguage: string;
  /** The processor's own word, e.g. "ingesting", "published", "failed"; null before its first answer. */
  phase: string | null;
  /** Text, Chapters, Level & words, On the shelf: how many are done, in order (0–4). */
  stagesDone: number;
  error: string | null;
}

export type TextSourceKind = 'GUTENBERG' | 'WIKISOURCE';
export type TextSourceStatus = 'FREE' | 'PROTECTED' | 'UNKNOWN';

/** A translator as the catalogue keeps them; the lives decide whether the translation is free. */
export interface TextSourceTranslator {
  name: string;
  birthYear: number | null;
  deathYear: number | null;
}

/** One place a work's text can be fetched from, judged for copyright where we make books. */
export interface TextSource {
  id: string;
  kind: TextSourceKind;
  language: string;
  label: string;
  translation: boolean;
  translators: TextSourceTranslator[];
  pageUrl: string;
  downloadUrl: string;
  status: TextSourceStatus;
  freeFrom: number | null;
}

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
  /** Set once /ops started preparing it from a free text. */
  preparing: DemandPreparing | null;
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

  /**
   * Moves the row to Being prepared on the Wanted page. With a source, the book processor fetches that text and
   * starts ingesting it; 409 for a protected source, a language the processor cannot read, or one already under way.
   */
  start(row: Pick<DemandWantedRow, 'catalogWorkId' | 'language'>, sourceId: string | null = null): Observable<unknown> {
    return this.http.post(`${this.wantedUrl(row)}/start`, sourceId ? {sourceId} : {}, {withCredentials: true});
  }

  /** Where the work's text can be fetched, free first. */
  sources(catalogWorkId: string): Observable<TextSource[]> {
    return this.http.get<TextSource[]>(`${AppConstants.OPS_URL}/catalog/works/${catalogWorkId}/sources`, {withCredentials: true});
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

/** "translated by Ruth Cohen (d. 1938)", "translator unknown", or "original". */
export function sourceTranslationLine(source: Pick<TextSource, 'translation' | 'translators'>): string {
  if (!source.translation) return 'original';
  if (source.translators.length === 0) return 'translator unknown';
  const names = source.translators.map(translator => translator.deathYear === null
    ? `${translator.name} (dates unknown)`
    : `${translator.name} (d. ${translator.deathYear})`);
  return `translation by ${names.join(', ')}`;
}

/** Why a source cannot be chosen, or null when it can. */
export function sourceBlockedReason(source: Pick<TextSource, 'status' | 'freeFrom'>): string | null {
  if (source.status !== 'PROTECTED') return null;
  return source.freeFrom === null
    ? 'Under copyright where we make books.'
    : `Under copyright where we make books until 1 January ${source.freeFrom}.`;
}
