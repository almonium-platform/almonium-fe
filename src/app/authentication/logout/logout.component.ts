import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {AuthService} from "../auth/auth.service";
import {NgxParticlesModule} from "@tsparticles/angular";
import {finalize, forkJoin, Subject, timer} from "rxjs";
import {GifPlayerComponent} from "../../shared/gif-player/gif-player.component";

@Component({
  selector: 'app-logout',
  imports: [
    NgxParticlesModule,
    GifPlayerComponent
  ],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.less'
})
export class LogoutComponent implements OnInit {
  private readonly timeout = 250;
  private router: Router;
  loggingOutMessage: string = 'Logging out';
  intervalId: any;
  protected replayGifTrigger = new Subject<void>();

  constructor(private authService: AuthService,
              router: Router) {
    this.router = router;
  }

  ngOnInit(): void {
    this.startMessageAnimation();
    this.replayGifTrigger.next();
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
