import {TestBed} from '@angular/core/testing';
import {take} from 'rxjs';
import {RecentAuthGuardStateService} from './recent-auth-guard-state.service';

describe('RecentAuthGuardStateService', () => {
  it('does not retain a dismissed verification request', () => {
    const service = TestBed.inject(RecentAuthGuardStateService);
    const states: {visible: boolean; actionLabel: string}[] = [];
    service.recentAuthState$.pipe(take(3)).subscribe(state => states.push(state));

    service.open('Delete account');
    service.close();

    expect(states).toEqual([
      {visible: false, actionLabel: 'Continue'},
      {visible: true, actionLabel: 'Delete account'},
      {visible: false, actionLabel: 'Delete account'},
    ]);
  });
});
