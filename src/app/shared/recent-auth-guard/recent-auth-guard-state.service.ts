import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RecentAuthGuardStateService {
  private recentAuthState = new BehaviorSubject<{visible: boolean; actionLabel: string}>({
    visible: false,
    actionLabel: 'Continue',
  });
  recentAuthState$ = this.recentAuthState.asObservable();

  open(actionLabel = 'Continue') {
    this.recentAuthState.next({visible: true, actionLabel});
  }

  close() {
    this.recentAuthState.next({...this.recentAuthState.value, visible: false});
  }
}
