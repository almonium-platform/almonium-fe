import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {AuthService} from "../auth/auth.service";
import {NgClass, NgOptimizedImage} from "@angular/common";
import {NgxParticlesModule} from "@tsparticles/angular";
import {finalize, forkJoin, timer} from "rxjs";

@Component({
    selector: 'app-logout',
    imports: [
        NgOptimizedImage,
        NgxParticlesModule,
        NgClass
    ],
    templateUrl: './logout.component.html',
    styleUrl: './logout.component.less'
})
export class LogoutComponent implements OnInit {
  private readonly timeout = 250;
  private router: Router;
  isRotating: boolean = true;
  loggingOutMessage: string = 'Logging out';
  private intervalId: any;

  constructor(private authService: AuthService,
              router: Router) {
    this.router = router;
  }

  ngOnInit(): void {
    this.startMessageAnimation();
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

  private startMessageAnimation(): void {
    const messages = ['Logging out', 'Logging out.', 'Logging out..', 'Logging out...'];
    let index = 0;
    this.intervalId = setInterval(() => {
      this.loggingOutMessage = messages[index];
      index = (index + 1) % messages.length;
    }, this.timeout);
  }
}
