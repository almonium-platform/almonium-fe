import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AppConstants} from '../app.constants';

export enum Entitlement {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  UNLIMITED = 'UNLIMITED',
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
}
