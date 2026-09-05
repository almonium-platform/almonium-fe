import {Component, DestroyRef, OnInit, inject} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {HttpClient} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {catchError, map, of} from 'rxjs';
import {AppConstants} from '../../app.constants';
import {expectNumber, expectRecord} from '../../shared/runtime-validation';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.less'
})
export class LandingComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * How many founding places are left, from the same endpoint the pricing page uses. It was a pair of hardcoded
   * numbers, which is how a landing page ends up advertising fifty places against a ceiling of twenty. Until it
   * arrives the sentence simply omits the count rather than guessing at one.
   */
  protected placesLeft: number | null = null;

  ngOnInit(): void {
    this.http.get<unknown>(`${AppConstants.PUBLIC_URL}/founding-members`).pipe(
      map(value => {
        const status = expectRecord(value, 'founding-member status');
        const capacity = expectNumber(status['capacity'], 'founding-member status.capacity');
        const claimed = expectNumber(status['claimed'], 'founding-member status.claimed');
        return Math.max(0, capacity - claimed);
      }),
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(left => this.placesLeft = left);
  }
}
