import {Injectable} from '@angular/core';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RecentAuthGuardStateService {
  private recentAuthState = new Subject<{ visible: boolean }>();
  recentAuthState$ = this.recentAuthState.asObservable();

  open() {
    this.recentAuthState.next({visible: true});
  }
}
