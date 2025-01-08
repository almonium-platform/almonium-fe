import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RecentAuthGuardStateService {
  private recentAuthState = new BehaviorSubject<{ visible: boolean }>({visible: false});
  recentAuthState$ = this.recentAuthState.asObservable();

  open() {
    this.recentAuthState.next({visible: true});
  }
}
