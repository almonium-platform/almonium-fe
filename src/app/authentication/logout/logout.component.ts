import {Component, OnInit} from '@angular/core';
import {AuthService} from "../auth/auth.service";
import {forkJoin, timer} from "rxjs";
import {finalize} from "rxjs/operators";
import {LoadingIndicatorComponent} from "../../shared/loading-indicator/loading-indicator.component";

@Component({
  selector: 'app-logout',
  imports: [
    LoadingIndicatorComponent
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.less'
})
export class LogoutComponent implements OnInit {

  constructor(private authService: AuthService) {
  }

  ngOnInit(): void {
    const minDisplayTime$ = timer(1000);
    const logout$ = this.authService.logout();

    forkJoin([logout$, minDisplayTime$]).pipe(
      finalize(() => {
        // Perform a hard redirect to the login page.
        // This will force a full application reload and a fresh CSRF token handshake.
        window.location.href = '/auth#sign-in';
      })
    ).subscribe({
      error: (err) => {
        console.error('Logout API call failed, but still redirecting.', err);
      }
    });
  }
}
