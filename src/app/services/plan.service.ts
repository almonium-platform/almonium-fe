import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AppConstants} from "../app.constants";
import {PlanDto} from "../models/plan.model";


@Injectable({
  providedIn: 'root',
})
export class PlanService {
  constructor(private http: HttpClient,
  ) {
  }

  getPlans(): Observable<PlanDto[]> {
    return this.http.get<PlanDto[]>(`${AppConstants.PLAN_URL}`).pipe(
      catchError((error) => {
        console.error('Error fetching cards:', error);
        return of([]);
      })
    );
  }

  subscribeToPlan(planId: string): Observable<any> {
    return this.http.post(`${AppConstants.SUBSCRIPTION_URL}/plans/${planId}`, {}, {withCredentials: true}).pipe(
      catchError((error) => {
        console.error('Error subscribing to plan:', error);
        return of(null);
      })
    );
  }

  accessCustomerPortal(): Observable<any> {
    return this.http.post(`${AppConstants.SUBSCRIPTION_URL}/portal`, {}, {withCredentials: true}).pipe(
      catchError((error) => {
        console.error('Error accessing portal:', error);
        return of(null);
      })
    );
  }

  cancelSubscription() {
    return this.http.delete(`${AppConstants.SUBSCRIPTION_URL}`, {withCredentials: true}).pipe(
      catchError((error) => {
        console.error('Error canceling subscription:', error);
        return of(null);
      })
    );
  }
}
