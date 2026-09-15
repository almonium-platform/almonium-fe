import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from "../app.constants";
import {parsePlans, parseSessionUrlResponse, PlanDto, SessionUrlResponse} from "../models/plan.model";
import {
  CadenceChangeKind,
  CadenceChangePreview,
  parseCadenceChangePreview,
} from "../models/cadence-change.model";
import {PlanType} from "../models/userinfo.model";

@Injectable({
  providedIn: 'root',
})
export class PlanService {
  private http = inject(HttpClient);


  getPlans(): Observable<PlanDto[]> {
    return this.http.get<unknown>(`${AppConstants.PLAN_URL}`).pipe(map(parsePlans));
  }

  subscribeToPlan(planId: string, founder: boolean): Observable<SessionUrlResponse> {
    return this.http.post<unknown>(
      `${AppConstants.SUBSCRIPTION_URL}/plans/${planId}`,
      {},
      {withCredentials: true, params: {founder}},
    )
      .pipe(map(parseSessionUrlResponse));
  }

  accessCustomerPortal(): Observable<SessionUrlResponse> {
    return this.http.post<unknown>(`${AppConstants.SUBSCRIPTION_URL}/portal`, {}, {withCredentials: true})
      .pipe(map(parseSessionUrlResponse));
  }

  cancelSubscription(): Observable<void> {
    return this.http.delete<void>(`${AppConstants.SUBSCRIPTION_URL}`, {withCredentials: true});
  }

  /**
   * What the change would cost, before anything is charged. Every figure the confirmation screen shows comes from
   * here: the client never works out a proration of its own.
   */
  previewCadenceChange(target: PlanType): Observable<CadenceChangePreview> {
    return this.http.get<unknown>(`${AppConstants.SUBSCRIPTION_URL}/cadence-change`, {
      withCredentials: true,
      params: {target},
    }).pipe(map(parseCadenceChangePreview));
  }

  changeCadence(target: PlanType, option: CadenceChangeKind): Observable<void> {
    return this.http.post<void>(
      `${AppConstants.SUBSCRIPTION_URL}/cadence-change`,
      {},
      {withCredentials: true, params: {target, option}},
    );
  }

  undoCadenceChange(): Observable<void> {
    return this.http.delete<void>(`${AppConstants.SUBSCRIPTION_URL}/cadence-change`, {withCredentials: true});
  }
}
