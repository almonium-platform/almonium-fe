import {TestBed} from '@angular/core/testing';
import {take} from 'rxjs';
import {RecentAuthGuardStateService} from './recent-auth-guard-state.service';

describe('RecentAuthGuardStateService', () => {
  it('does not retain a dismissed verification request', () => {
    const service = TestBed.inject(RecentAuthGuardStateService);
    const states: boolean[] = [];
    service.recentAuthState$.pipe(take(3)).subscribe(state => states.push(state.visible));

    service.open();
    service.close();

    expect(states).toEqual([false, true, false]);
  });
});
