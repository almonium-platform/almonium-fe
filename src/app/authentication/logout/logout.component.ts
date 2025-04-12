import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {AuthService} from "../auth/auth.service";
import {NgxParticlesModule} from "@tsparticles/angular";
import {finalize, forkJoin, timer} from "rxjs";
import {LoadingIndicatorComponent} from "../../shared/loading-indicator/loading-indicator.component";

@Component({
  selector: 'app-logout',
  imports: [
    NgxParticlesModule,
    LoadingIndicatorComponent
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.less'
})
export class LogoutComponent implements OnInit {

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
  }

  ngOnInit(): void {
    const minDisplayTime$ = timer(1000);
    const logout$ = this.authService.logout();

    forkJoin([logout$, minDisplayTime$]).pipe(
      finalize(() => {
        this.router.navigate(['/auth'], {fragment: 'sign-in'}).then(() => {
        }).catch(err => {
          console.error("Navigation failed after logout:", err);
        });
      })
    ).subscribe({
      error: (err) => {
        console.error('Logout API call failed, redirecting to login.', err);
      }
    });
  }
}
