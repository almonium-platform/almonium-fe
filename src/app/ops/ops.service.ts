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

@Injectable({
  providedIn: 'root',
})
export class OpsService {
  private http = inject(HttpClient);

  /**
   * Looks up a user by email so an operator can find their ID without querying the database directly.
   */
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
   * Posts to a broadcast channel as Almonium itself. Members cannot write to those channels, so
   * this is the only way anything is published there.
   */
  publishAnnouncement(request: AnnouncementRequest): Observable<unknown> {
    const url = `${AppConstants.OPS_URL}/chat/announcements`;
    return this.http.post(url, request, {withCredentials: true});
  }
}
