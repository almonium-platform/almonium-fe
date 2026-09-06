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

@Injectable({
  providedIn: 'root',
})
export class OpsService {
  private http = inject(HttpClient);

  /**
   * Looks up a user by email so an operator can find their ID without querying the database directly.
   */
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
}
