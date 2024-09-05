import {ChangeDetectionStrategy, Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {AuthService} from "../auth/auth.service";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  userInfo: any;

  constructor(private authService: AuthService) {
    this.authService.getUserInfo().subscribe({
      next: userInfo => {
        this.userInfo = userInfo;
      },
      error: error => {
        console.log('Failed to load user info', error);
      }
    });
  }
}
