import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {AppConstants} from "../app.constants";
import {LanguageSetupRequest} from "./language-setup/language-setup.model";
import {Learner, SetupStep} from "../models/userinfo.model";

@Injectable({
  providedIn: 'root',
})
export class OnboardingService {
  constructor(private http: HttpClient) {
  }

  completeStep(step: SetupStep): Observable<any> {
    const url = `${AppConstants.ONBOARDING_STEP_URL}/${step}`;
    return this.http.patch(url, {}, {withCredentials: true});
  }

  setupLanguages(payload: LanguageSetupRequest): Observable<Learner[]> {
    const url = `${AppConstants.ONBOARDING_URL}/langs`;
    return this.http.put<Learner[]>(url, payload, {withCredentials: true});
  }

  saveInterests(ids: number[]): Observable<any> {
    const url = `${AppConstants.ONBOARDING_URL}/interests`;
    return this.http.post(url, {ids}, {withCredentials: true});
  }
}
