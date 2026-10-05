import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

export type RightsStatus = 'FREE' | 'PROTECTED' | 'UNKNOWN';
export type RightsEffect = 'BLOCK' | 'ALLOW';
export type ReporterRole = 'RIGHTS_HOLDER' | 'READER' | 'OTHER';
export type RightsReportStatus = 'OPEN' | 'ACTIONED' | 'DISMISSED';
/** Why a work is hidden in a country: the copyright engine's verdict, or an operator's override. */
export type BlockSource = 'ENGINE' | 'OVERRIDE';

/** One report from the book page's report button. Open ones come first. */
export interface RightsReportRow {
  id: string;
  workSlug: string;
  editionSlug: string;
  bookTitle: string;
  role: ReporterRole;
  reporterName: string | null;
  reporterEmail: string | null;
  /** The country the report is about; blank or null for everywhere. */
  country: string | null;
  /** Where the reporter's address placed them. */
  detectedCountry: string | null;
  message: string;
  status: RightsReportStatus;
  createdAt: string;
  handledAt: string | null;
}

/** `*` is everywhere. An override always wins over the engine. */
export interface RightsOverrideRequest {
  workSlug: string;
  country: string;
  effect: RightsEffect;
  reason: string;
  reportId?: string;
}

export interface RightsOverrideRow {
  id: string;
  workSlug: string;
  country: string;
  effect: RightsEffect;
  reason: string;
  reportId: string | null;
  createdAt: string;
}

/** One shelf work in the rights list. */
export interface WorkRightsRow {
  workSlug: string;
  title: string;
  author: string;
  /** Whether a catalogue work supplies its facts; an unlinked work is judged by its edition alone. */
  linked: boolean;
  productionStatus: RightsStatus;
  blockedEverywhere: boolean;
  blockedCountries: number;
  overrides: number;
}

export interface CatalogAuthorFacts {
  name: string;
  wikidataId: string | null;
  birthYear: number | null;
  deathYear: number | null;
  diedForFrance: boolean;
  rehabilitatedYear: number | null;
}

/** Everything needed to judge one work: the facts, the verdict where books are made, and every block and override. */
export interface WorkRightsView {
  workSlug: string;
  title: string;
  author: string;
  catalogWorkId: string | null;
  wikidataId: string | null;
  publicationYear: number | null;
  authors: CatalogAuthorFacts[];
  productionStatus: RightsStatus;
  productionFreeFrom: number | null;
  blockedCountries: Record<string, BlockSource>;
  /** Country to the first year the work is free there, for every country that protects it. */
  protectedUntil: Record<string, number>;
  unknownCountries: string[];
  overrides: RightsOverrideRow[];
}

export type CatalogImportState = 'NEVER' | 'RUNNING' | 'DONE' | 'FAILED';

export interface CatalogImportRun {
  state: CatalogImportState;
  startedAt: string | null;
  finishedAt: string | null;
  works: number;
  titles: number;
  linked: number;
  error: string | null;
}

/** /ops → Rights: reports, takedowns, the facts behind each shelf work, and the catalogue they come from. */
@Injectable({providedIn: 'root'})
export class OpsRightsService {
  private http = inject(HttpClient);
  private readonly rightsUrl = `${AppConstants.OPS_URL}/rights`;

  reports(): Observable<RightsReportRow[]> {
    return this.http.get<RightsReportRow[]>(`${this.rightsUrl}/reports`, {withCredentials: true});
  }

  dismissReport(id: string): Observable<RightsReportRow> {
    return this.http.post<RightsReportRow>(`${this.rightsUrl}/reports/${id}/dismiss`, {}, {withCredentials: true});
  }

  /** The takedown: `*` and BLOCK hides the work everywhere within a minute. */
  addOverride(request: RightsOverrideRequest): Observable<RightsOverrideRow> {
    return this.http.post<RightsOverrideRow>(`${this.rightsUrl}/overrides`, request, {withCredentials: true});
  }

  /** Hands the country back to the engine. */
  removeOverride(id: string): Observable<unknown> {
    return this.http.delete(`${this.rightsUrl}/overrides/${id}`, {withCredentials: true});
  }

  works(): Observable<WorkRightsRow[]> {
    return this.http.get<WorkRightsRow[]>(`${this.rightsUrl}/works`, {withCredentials: true});
  }

  work(workSlug: string): Observable<WorkRightsView> {
    return this.http.get<WorkRightsView>(`${this.rightsUrl}/works/${encodeURIComponent(workSlug)}`, {withCredentials: true});
  }

  /** Names the catalogue work a shelf work is an edition of; its facts then decide the work's rights. */
  linkCatalogWork(workSlug: string, catalogWorkId: string): Observable<WorkRightsView> {
    return this.http.put<WorkRightsView>(`${this.rightsUrl}/works/${encodeURIComponent(workSlug)}/catalog`, {catalogWorkId}, {withCredentials: true});
  }

  recompute(): Observable<{works: number}> {
    return this.http.post<{works: number}>(`${this.rightsUrl}/recompute`, {}, {withCredentials: true});
  }

  catalogImport(): Observable<CatalogImportRun> {
    return this.http.get<CatalogImportRun>(`${AppConstants.OPS_URL}/catalog/import`, {withCredentials: true});
  }

  startCatalogImport(): Observable<CatalogImportRun> {
    return this.http.post<CatalogImportRun>(`${AppConstants.OPS_URL}/catalog/import`, {}, {withCredentials: true});
  }
}

/** Blocked everywhere first, then works without catalogue facts, then by title: the ones that need a look on top. */
export function sortWorkRights(rows: readonly WorkRightsRow[]): WorkRightsRow[] {
  return [...rows].sort((a, b) =>
    Number(b.blockedEverywhere) - Number(a.blockedEverywhere)
    || Number(a.linked) - Number(b.linked)
    || a.title.localeCompare(b.title));
}

/** A report about one country is taken down there; one about nowhere in particular, everywhere. */
export function takedownCountry(report: Pick<RightsReportRow, 'country'>): string {
  const country = report.country?.trim().toUpperCase() ?? '';
  return country || '*';
}

/** Author lives as the engine read them: "1899–1977", "b. 1899", "d. 1977", "dates unknown", plus the two extensions. */
export function authorLife(author: CatalogAuthorFacts): string {
  const {birthYear: born, deathYear: died} = author;
  const span = born !== null && died !== null ? `${born}–${died}`
    : born !== null ? `b. ${born}`
    : died !== null ? `d. ${died}`
    : 'dates unknown';
  const notes = [
    ...(author.diedForFrance ? ['mort pour la France'] : []),
    ...(author.rehabilitatedYear !== null ? [`rehabilitated ${author.rehabilitatedYear}`] : []),
  ];
  return notes.length ? `${span} · ${notes.join(' · ')}` : span;
}

/** Map entries as rows, `*` first and then by country code. */
export function countryEntries<T>(map: Record<string, T>): {country: string; value: T}[] {
  return Object.entries(map)
    .map(([country, value]) => ({country, value}))
    .sort((a, b) => (a.country === '*' ? -1 : b.country === '*' ? 1 : a.country.localeCompare(b.country)));
}
