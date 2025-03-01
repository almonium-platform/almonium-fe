import {Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Observable} from "rxjs";
import {AppConstants} from "../../app.constants";
import {Notification} from "./notification.model";

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private http: HttpClient) {
  }

  getNotifications(): Observable<Notification[]> {
    const url = `${AppConstants.NOTIFICATIONS_URL}`;
    return this.http.get<Notification[]>(url, {withCredentials: true});
  }
}
