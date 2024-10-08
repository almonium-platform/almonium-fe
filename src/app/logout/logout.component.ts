import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {AuthService} from "../auth/auth.service";
import {AsyncPipe, NgClass, NgIf, NgOptimizedImage} from "@angular/common";
import {NgxParticlesModule} from "@tsparticles/angular";

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
    this.authService.logout().subscribe({
      next: () => {
        setTimeout(() => this.router.navigate(['/auth'], {fragment: 'sign-in'}).then(), 1000);
      },
      error: _ => {
        this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
      }
    });
  }
}
