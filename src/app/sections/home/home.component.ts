import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {UserInfoService} from '../../services/user-info.service';
import {Subject, takeUntil} from 'rxjs';
import {SetupStep, UserInfo} from "../../models/userinfo.model";
import {Router} from "@angular/router";
import {NotReadyComponent} from "../../shared/not-ready/not-ready.component";
import {FirebaseNotificationService} from "../../services/firebase-notification.service";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.less'],
  imports: [
    NotReadyComponent
  ]
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  userInfo: UserInfo | null = null;

  constructor(
    private userService: UserInfoService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    protected firebaseNotificationService: FirebaseNotificationService,
  ) {
    firebaseNotificationService.initFCM().then();
  }

  ngOnInit(): void {
    // Subscribe to the shared user info observable
    this.userService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe((info) => {
      this.userInfo = info;
      if (info?.setupStep! !== SetupStep.COMPLETED) {
        this.router.navigate(['/onboarding']).then();
      }
      this.cdr.markForCheck(); // Trigger change detection manually to update the view
    });

    // Optionally, load user info if not present
    this.userService.loadUserInfo().subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
