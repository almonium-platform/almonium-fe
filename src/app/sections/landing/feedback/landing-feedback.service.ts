import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../../app.constants';

export interface LandingFeedback {
  message: string;
  email?: string;
  locale: string;
  /** The honeypot: hidden from people, so only a bot fills it in. */
  website: string;
}

/** The landing page's question: one mail to the founder's inbox per answer, three an hour from one address. */
@Injectable({providedIn: 'root'})
export class LandingFeedbackService {
  private http = inject(HttpClient);

  send(feedback: LandingFeedback): Observable<void> {
    return this.http.post(`${AppConstants.PUBLIC_URL}/feedback`, feedback, {withCredentials: true}).pipe(map(() => undefined));
  }
}
