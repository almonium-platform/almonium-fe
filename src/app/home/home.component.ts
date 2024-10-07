import {ChangeDetectorRef, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AuthService} from "../auth/auth.service";
import {UserInfo} from "./userinfo.model";
import {Router} from "@angular/router";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less'],
})
export class HomeComponent {
  userInfo: UserInfo | null = null;

  constructor(private authService: AuthService,
              private cdr: ChangeDetectorRef,
              private router: Router) {
    this.authService.getUserInfo().subscribe({
      next: userInfo => {
        this.userInfo = userInfo;
        if (!userInfo.setupCompleted) {
          this.router.navigate(['/setup-languages']).then(r => r);
        }
        this.cdr.markForCheck();
      },
      error: error => {
        console.log('Failed to load user info', error);
      }
    });
  }
}
