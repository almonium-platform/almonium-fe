import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {AppConstants} from '../../../app.constants';
import {RightsReportReceipt, RightsReportRequest, parseRightsReportReceipt} from './rights-report.model';

/** The report button: open to guests, mailed to the copyright address at once, five an hour from one address. */
@Injectable({providedIn: 'root'})
export class RightsReportService {
  private http = inject(HttpClient);

  report(editionSlug: string, report: RightsReportRequest): Observable<RightsReportReceipt> {
    const url = `${AppConstants.PUBLIC_BOOKS_URL}/${encodeURIComponent(editionSlug)}/rights-reports`;
    return this.http.post<unknown>(url, report, {withCredentials: true}).pipe(map(parseRightsReportReceipt));
  }
}
