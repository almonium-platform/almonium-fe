import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

export enum Entitlement {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  UNLIMITED = 'UNLIMITED',
}

/** The rooms the backend actually runs; mirrors SUPPORTED_LANGUAGES in StreamChatService. */
export type BroadcastLanguage = 'EN' | 'DE' | 'ES' | 'FR' | 'IT';

/** Labelled with the channel's real name, so an operator picks a room rather than a language. */
export const BROADCAST_CHANNELS: {value: BroadcastLanguage | ''; label: string}[] = [
  {value: '', label: 'Almonium — everyone'},
  {value: 'EN', label: 'Almonium - English'},
  {value: 'DE', label: 'Almonium - Deutsch'},
  {value: 'ES', label: 'Almonium - Español'},
  {value: 'FR', label: 'Almonium - Français'},
  {value: 'IT', label: 'Almonium - Italiano'},
];

export interface AnnouncementRequest {
  language: BroadcastLanguage | null;
  text: string;
}

export interface FirebaseAuthProviderSummary {
  provider: string;
  email: string | null;
}

export interface FirebaseAccountSummary {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  providers: FirebaseAuthProviderSummary[];
}

export interface AccessGrantRequest {
  entitlement: Entitlement;
  expiresAt: string | null;
  reason: string;
}

export interface OpsActiveGrant {
  entitlement: Entitlement;
  expiresAt: string | null;
  reason: string;
}

export interface OpsUserSummary {
  id: string;
  email: string;
  username: string;
  effectiveEntitlement: Entitlement;
  activeGrant: OpsActiveGrant | null;
}

/** One feature's share of the model bill, from our own ledger. `estimatedUsd` is null when the model has no price. */
export interface SpendEstimatedLine {
  source: 'almo' | 'books';
  feature: string;
  model: string;
  requests: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  estimatedUsd: number | null;
}

/** One day's charge for one line item, as OpenAI billed it. */
export interface SpendActualLine {
  day: string;
  projectId: string;
  lineItem: string;
  usd: number;
}

/** Sign-ups and returning users since `since`; "today" starts at UTC midnight, the others trail the clock. */
export interface StatsWindow {
  label: string;
  since: string;
  registered: number;
  active: number;
}

export interface SubscriptionCount {
  plan: string;
  cadence: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
  status: 'ACTIVE' | 'ACTIVE_TILL_CYCLE_END' | 'CANCELED' | 'PAUSED' | 'INACTIVE';
  count: number;
}

export interface GrantCount {
  entitlement: Entitlement;
  count: number;
}

/** How the product is doing, counted from our own tables. Nothing here calls out to Paddle or OpenAI. */
export interface StatsReport {
  generatedAt: string;
  totalUsers: number;
  windows: StatsWindow[];
  subscriptions: SubscriptionCount[];
  activeGrants: GrantCount[];
  /** Members whose only premium is a grant: no paid plan active or running out its cycle. */
  grantOnlyMembers: number;
  foundingMembers: {confirmed: number; reserved: number; available: number};
}

export interface SpendReport {
  since: string;
  until: string;
  estimated: SpendEstimatedLine[];
  estimatedUsd: number;
  actual: SpendActualLine[];
  actualUsd: number;
  actualFetchedAt: string | null;
  warnings: string[];
}

export type TranslationJobPhase = 'QUEUED' | 'TRANSLATING' | 'ALIGNING' | 'QA_GATE' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'CANCELLED';

/** One approved pair, mirrored read-only from the book processor's own states. */
export interface TranslationJob {
  id: string;
  phase: TranslationJobPhase;
  progressCompleted: number | null;
  progressTotal: number | null;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  tier: string;
  mode: string;
  processorEditionSlug: string | null;
  approvedAt: string;
  finishedAt: string | null;
  error: string;
  publishedBookId: string | null;
  publishedEditionSlug: string | null;
}

/** One (book, language) pair: the asks are the whole demand signal, no voting UI needed. */
export interface TranslationQueueRow {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  editionSlug: string;
  sourceLanguage: string;
  language: string;
  asks: number;
  premiumAsks: number;
  freeAsks: number;
  estimatedCostUsd: number | null;
  job: TranslationJob | null;
}

export interface TranslationQueue {
  open: number;
  running: number;
  published: number;
  declined: number;
  monthSpendUsd: number;
  monthBudgetUsd: number;
  budgetExhausted: boolean;
  monthStartsAt: string;
  rows: TranslationQueueRow[];
  warnings: string[];
}

export type LibrarySuggestionStatus = 'SUGGESTED' | 'INGESTING' | 'PUBLISHED' | 'DECLINED';

export interface LibraryMatch {
  bookId: string;
  editionSlug: string;
  title: string;
}

export interface IngestJob {
  processorEditionId: string | null;
  processorEditionSlug: string | null;
  phase: string | null;
  progress: number;
  error: string;
  decidedAt: string | null;
  publishedBookId: string | null;
}

/** Suggestions grouped by title and author; the import count is the demand signal. */
export interface LibrarySuggestionRow {
  id: string;
  title: string;
  author: string;
  language: string;
  publicationYear: number | null;
  publicDomainHint: 'pd' | 'check';
  imports: number;
  premiumCount: number;
  freeCount: number;
  status: LibrarySuggestionStatus;
  libraryMatch: LibraryMatch | null;
  job: IngestJob | null;
  createdAt: string;
}

export interface LibrarySuggestionQueue {
  open: number;
  ingesting: number;
  published: number;
  declined: number;
  rows: LibrarySuggestionRow[];
  warnings: string[];
}

@Injectable({
  providedIn: 'root',
})
export class OpsService {
  private http = inject(HttpClient);

  /**
   * Looks up a user by email so an operator can find their ID without querying the database directly.
   */
  /** Who signed up, who came back, who pays, and who is a member by grant, right now. */
  stats(): Observable<StatsReport> {
    const url = `${AppConstants.OPS_URL}/stats`;
    return this.http.get<StatsReport>(url, {withCredentials: true});
  }

  /** What the models cost over the last `days` days: our ledgers priced by our table, and the bill itself. */
  spendReport(days: number): Observable<SpendReport> {
    const url = `${AppConstants.OPS_URL}/spend`;
    return this.http.get<SpendReport>(url, {params: {days}, withCredentials: true});
  }

  findUserByEmail(email: string): Observable<OpsUserSummary> {
    const url = `${AppConstants.OPS_URL}/users`;
    return this.http.get<OpsUserSummary>(url, {params: {email}, withCredentials: true});
  }

  /**
   * Replaces the target user's active access grant, overriding their plan-derived entitlement.
   */
  grantAccess(userId: string, request: AccessGrantRequest): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/users/${userId}/access-grant`;
    return this.http.post(url, request, {withCredentials: true});
  }

  /**
   * Revokes the target user's active access grant, falling back to their plan-derived entitlement.
   */
  revokeAccess(userId: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/users/${userId}/access-grant`;
    return this.http.delete(url, {withCredentials: true});
  }

  /**
   * Credits back the book imports the user has spent this period. The reason is kept with the
   * adjustment, which is the only record that the allowance was ever moved.
   */
  resetBookImportQuota(userId: string, reason: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/users/${userId}/book-import-quota/reset`;
    return this.http.post(url, {reason}, {withCredentials: true});
  }

  /**
   * Hands back the once-a-month active-language switch, whatever the calendar says.
   */
  resetActiveLanguageSwitch(userId: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/users/${userId}/active-language-switch/reset`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  /**
   * Stream users with no row in our database: a dropped database or a half-failed deletion leaves
   * accounts behind that nothing else can notice. Read-only, so it is safe to look.
   */
  findOrphanedStreamUsers(): Observable<string[]> {
    const url = `${AppConstants.OPS_URL}/chat/orphans`;
    return this.http.get<string[]>(url, {withCredentials: true});
  }

  deleteOrphanedStreamUsers(): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/chat/orphans`;
    return this.http.delete(url, {withCredentials: true});
  }

  /** The phrase the backend will demand before it empties the Stream application. */
  purgeConfirmationPhrase(): Observable<{confirmation: string}> {
    const url = `${AppConstants.OPS_URL}/chat/purge`;
    return this.http.get<{confirmation: string}>(url, {withCredentials: true});
  }

  /** Deletes every Stream channel and user, then rebuilds the broadcast channels. */
  purgeStream(confirmation: string): Observable<{message: string}> {
    const url = `${AppConstants.OPS_URL}/chat/purge`;
    return this.http.post<{message: string}>(url, {confirmation}, {withCredentials: true});
  }

  /**
   * What Firebase itself believes about an account. Our row and Firebase can disagree for months
   * without anything noticing, and this is the only place that shows both halves.
   */
  findFirebaseAccount(email: string): Observable<FirebaseAccountSummary> {
    const url = `${AppConstants.OPS_URL}/firebase/users`;
    return this.http.get<FirebaseAccountSummary>(url, {params: {email}, withCredentials: true});
  }

  /** The Firebase project the backend is pointed at, and how many accounts live in it. */
  firebasePurgeInfo(): Observable<{confirmation: string; userCount: number}> {
    const url = `${AppConstants.OPS_URL}/firebase/users/purge`;
    return this.http.get<{confirmation: string; userCount: number}>(url, {withCredentials: true});
  }

  /** Deletes Firebase accounts. The operator's own is spared unless explicitly included. */
  purgeFirebase(confirmation: string, includeOperator: boolean): Observable<{message: string}> {
    const url = `${AppConstants.OPS_URL}/firebase/users/purge`;
    return this.http.post<{message: string}>(url, {confirmation, includeOperator}, {withCredentials: true});
  }

  /**
   * Gives every account its Stream user, memberships and Saved Messages back. Idempotent, so it
   * repairs a half-provisioned account and leaves a healthy one alone.
   */
  provisionStreamAccounts(): Observable<{message: string}> {
    const url = `${AppConstants.OPS_URL}/chat/users/provision`;
    return this.http.post<{message: string}>(url, {}, {withCredentials: true});
  }

  /** Re-stamps the system channels with the artwork this client currently serves. */
  syncSystemChannelArtwork(): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/chat/system-channels/artwork`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  /**
   * Posts to a broadcast channel as Almonium itself. Members cannot write to those channels, so
   * this is the only way anything is published there.
   */
  publishAnnouncement(request: AnnouncementRequest): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/chat/announcements`;
    return this.http.post(url, request, {withCredentials: true});
  }

  // --- Books: the translation-request queue (G9) and the library suggestions (G13) ---

  translationQueue(): Observable<TranslationQueue> {
    const url = `${AppConstants.OPS_URL}/books/translation-requests`;
    return this.http.get<TranslationQueue>(url, {withCredentials: true});
  }

  approveTranslation(bookId: string, language: string, tier = 'quality', mode = 'batch'): Observable<TranslationJob> {
    const url = `${AppConstants.OPS_URL}/books/translation-requests/${bookId}/${language}/approve`;
    return this.http.post<TranslationJob>(url, {tier, mode}, {withCredentials: true});
  }

  declineTranslation(bookId: string, language: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/books/translation-requests/${bookId}/${language}`;
    return this.http.delete(url, {withCredentials: true});
  }

  cancelTranslationJob(jobId: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/books/translation-jobs/${jobId}/cancel`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  librarySuggestions(): Observable<LibrarySuggestionQueue> {
    const url = `${AppConstants.OPS_URL}/books/library-suggestions`;
    return this.http.get<LibrarySuggestionQueue>(url, {withCredentials: true});
  }

  acceptSuggestion(id: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/books/library-suggestions/${id}/accept`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  declineSuggestion(id: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/books/library-suggestions/${id}/decline`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  pointSuggestionToLibrary(id: string, bookId: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/books/library-suggestions/${id}/point-to-library`;
    return this.http.post(url, {bookId}, {withCredentials: true});
  }

  cancelSuggestionIngest(id: string): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/books/library-suggestions/${id}/cancel`;
    return this.http.post(url, {}, {withCredentials: true});
  }

  /** The reviewer's read-only copy of the upload; streamed through the backend, never a processor URL. */
  suggestionFileUrl(id: string): string {
    return `${AppConstants.OPS_URL}/books/library-suggestions/${id}/file`;
  }
}
