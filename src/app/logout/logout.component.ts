import {Component, OnInit} from '@angular/core';
import {Router} from "@angular/router";
import {AuthService} from "../auth/auth.service";

@Component({
  selector: 'app-logout',
  standalone: true,
  imports: [],
  templateUrl: './logout.component.html',
  styleUrl: './logout.component.less'
})
export class LogoutComponent implements OnInit {

  private router: Router;

  constructor(private authService: AuthService,
              router: Router) {
    this.router = router;
  }

  ngOnInit(): void {
    this.authService.logout();
    this.router.navigate(['/auth'], {fragment: 'sign-in'}).then();
  }
}
