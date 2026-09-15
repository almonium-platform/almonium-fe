import { Injectable, inject } from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {map} from 'rxjs/operators';
import {AppConstants} from "../../app.constants";
import {Notification, parseNotifications} from "./notification.model";

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);


  getNotifications(): Observable<Notification[]> {
    const url = `${AppConstants.NOTIFICATIONS_URL}`;
    return this.http.get<unknown>(url, {withCredentials: true}).pipe(map(parseNotifications));
  }

  markAllAsRead(): Observable<unknown> {
    const url = `${AppConstants.NOTIFICATIONS_URL}/read`;
    return this.http.patch(url, {}, {withCredentials: true});
  }

  markAsRead(id: string): Observable<unknown> {
    const url = `${AppConstants.NOTIFICATIONS_URL}/${id}/read`;
    return this.http.patch(url, {}, {withCredentials: true});
  }

  markAsUnread(id: string): Observable<unknown> {
    const url = `${AppConstants.NOTIFICATIONS_URL}/${id}/unread`;
    return this.http.patch(url, {}, {withCredentials: true});
  }

  delete(id: string): Observable<unknown> {
    const url = `${AppConstants.NOTIFICATIONS_URL}/${id}`;
    return this.http.delete(url, {withCredentials: true});
  }
}
