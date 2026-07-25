import {logger} from "../shared/logger";
import { Injectable, inject } from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AppConstants} from "../app.constants";
import {PlanDto} from "../models/plan.model";

export interface SessionUrlResponse {
  sessionUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class PlanService {
  private http = inject(HttpClient);


  getPlans(): Observable<PlanDto[]> {
    return this.http.get<PlanDto[]>(`${AppConstants.PLAN_URL}`).pipe(
      catchError((error) => {
        logger.error('Error fetching plans:', error);
        return of([]);
      })
    );
  }

  subscribeToPlan(planId: string): Observable<SessionUrlResponse | null> {
    return this.http.post<SessionUrlResponse>(`${AppConstants.SUBSCRIPTION_URL}/plans/${planId}`, {}, {withCredentials: true}).pipe(
      catchError((error) => {
        logger.error('Error subscribing to plan:', error);
        return of(null);
      })
    );
  }

  accessCustomerPortal(): Observable<SessionUrlResponse | null> {
    return this.http.post<SessionUrlResponse>(`${AppConstants.SUBSCRIPTION_URL}/portal`, {}, {withCredentials: true}).pipe(
      catchError((error) => {
        logger.error('Error accessing portal:', error);
        return of(null);
      })
    );
  }

  cancelSubscription() {
    return this.http.delete(`${AppConstants.SUBSCRIPTION_URL}`, {withCredentials: true}).pipe(
      catchError((error) => {
        logger.error('Error canceling subscription:', error);
        return of(null);
      })
    );
  }
}
