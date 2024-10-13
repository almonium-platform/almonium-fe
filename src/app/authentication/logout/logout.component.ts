import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {AuthService} from "../auth/auth.service";
import {AsyncPipe, NgClass, NgIf, NgOptimizedImage} from "@angular/common";
import {NgxParticlesModule} from "@tsparticles/angular";
import {finalize, forkJoin, timer} from "rxjs";

@Component({
  selector: 'app-logout',
  standalone: true,
  imports: [
    AsyncPipe,
    NgIf,
    NgOptimizedImage,
    NgxParticlesModule,
    NgClass
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.less'
})
export class LogoutComponent implements OnInit {
  private router: Router;
  isRotating: boolean = true;

  constructor(private authService: AuthService,
              router: Router) {
    this.router = router;
  }

  ngOnInit(): void {
    const minDisplayTime$ = timer(1000);  // 1-second timer observable
    const logout$ = this.authService.logout();  // Logout API call

    // Run both the logout call and the timer in parallel
    forkJoin([logout$, minDisplayTime$]).pipe(
      finalize(() => {
        // Navigation logic goes here and will run whether success or error occurs
        this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
      })
    ).subscribe({
      error: () => {
        console.error('Logout failed, redirecting to login.');
      }
    });
  }
}
