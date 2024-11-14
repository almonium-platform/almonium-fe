import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {UserInfoService} from '../../services/user-info.service';
import {Subscription} from 'rxjs';
import {UserInfo} from "../../models/userinfo.model";
import {NavbarComponent} from "../../shared/navbars/navbar/navbar.component";
import {Router} from "@angular/router";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less'],
  imports: [
    NavbarComponent,
    NotReadyComponent
  ],
  standalone: true
})
export class HomeComponent implements OnInit, OnDestroy {
  userInfo: UserInfo | null = null;
  private userInfoSubscription: Subscription | null = null;

  constructor(
    private userService: UserInfoService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    // Subscribe to the shared user info observable
    this.userInfoSubscription = this.userService.userInfo$.subscribe((info) => {
      this.userInfo = info;
      if (!info?.setupCompleted) {
        this.router.navigate(['/setup-languages']).then(r => r);
      }
      this.cdr.markForCheck(); // Trigger change detection manually to update the view
    });

    // Optionally, load user info if not present
    this.userService.loadUserInfo().subscribe();
  }

  ngOnDestroy(): void {
    if (this.userInfoSubscription) {
      this.userInfoSubscription.unsubscribe();
    }
  }
}
