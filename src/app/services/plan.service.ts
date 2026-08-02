import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from "../app.constants";
import {parsePlans, parseSessionUrlResponse, PlanDto, SessionUrlResponse} from "../models/plan.model";

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
}
