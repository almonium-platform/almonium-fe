import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {AuthService} from "../auth/auth.service";
import {RouterOutlet} from "@angular/router";
import {NavbarComponent} from "../shared/navbar/navbar.component";

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less'],
  imports: [
    RouterOutlet,
    NavbarComponent
  ]
})
export class HomeComponent implements OnInit {
  userInfo: any | null = null;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    this.loadUserInfo();
  }

  private loadUserInfo(): void {
    const cachedUserInfo = this.authService.getLocalUserInfo();
    if (cachedUserInfo) {
      this.userInfo = cachedUserInfo;
      console.log('Loaded user info from cache', this.userInfo);
      this.cdr.markForCheck();
    } else {
      console.log('Loading user info from server');
      this.authService.getUserInfo().subscribe({
        next: userInfo => {
          this.userInfo = userInfo;
          this.cdr.markForCheck();
        },
        error: error => {
          console.log('Failed to load user info', error);
        }
      });
    }
  }
}
