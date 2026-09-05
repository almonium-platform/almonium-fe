import {logger} from "../../shared/logger";
import {Component, OnInit, inject} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {AuthService} from "../auth/auth.service";
import {forkJoin, timer} from "rxjs";
import {finalize} from "rxjs/operators";
import {LoadingIndicatorComponent} from "../../shared/loading-indicator/loading-indicator.component";
import {LANDING_ACCOUNT_DELETED_PARAM, LOGOUT_REASON_ACCOUNT_DELETED} from "./logout-reason";

@Component({
  selector: 'app-logout',
  imports: [
    LoadingIndicatorComponent
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.less'
})
export class LogoutComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  /** Set when the settings page sends a just-deleted account here. */
  protected accountDeleted = false;

  protected get baseText(): string {
    return this.accountDeleted ? 'Closing your account' : 'Logging out';
  }

  ngOnInit(): void {
    this.accountDeleted = this.route.snapshot.queryParamMap.get('reason') === LOGOUT_REASON_ACCOUNT_DELETED;

    const minDisplayTime$ = timer(1000);
    const logout$ = this.authService.logout();

    forkJoin([logout$, minDisplayTime$]).pipe(
      finalize(() => {
        // Perform a hard redirect. This forces a full application reload and a fresh CSRF token
        // handshake. A deleted account has nothing to sign back into, so it lands on the landing
        // page; a plain sign-out lands on the sign-in form.
        window.location.href = this.accountDeleted ? `/?${LANDING_ACCOUNT_DELETED_PARAM}=1` : '/auth#sign-in';
      })
    ).subscribe({
      error: (err) => {
        logger.error('Logout API call failed, but still redirecting.', err);
      }
    });
  }
}
