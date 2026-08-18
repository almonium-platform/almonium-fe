import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {BehaviorSubject, Subject, finalize, takeUntil} from 'rxjs';
import {Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {UserInfoService} from '../../services/user-info.service';
import {OnboardingService} from '../onboarding.service';
import {SetupStep, UserInfo} from '../../models/userinfo.model';
import {ButtonComponent} from '../../shared/button/button.component';
import {logger} from '../../shared/logger';

@Component({
  selector: 'app-onboarding-greeting',
  imports: [ButtonComponent],
  templateUrl: './greeting.component.html',
  styleUrl: './greeting.component.less',
})
export class GreetingComponent implements OnInit, OnDestroy {
  private readonly onboardingService = inject(OnboardingService);
  private readonly userInfoService = inject(UserInfoService);
  private readonly router = inject(Router);
  private readonly alertService = inject(TuiNotificationService);
  private readonly destroy$ = new Subject<void>();
  private readonly loadingSubject$ = new BehaviorSubject(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();
  protected userInfo: UserInfo | null = null;

  ngOnInit(): void {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe(userInfo => this.userInfo = userInfo);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected startReading(): void {
    this.loadingSubject$.next(true);
    this.onboardingService.completeStep(SetupStep.GREETING)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.userInfoService.updateUserInfo({setupStep: SetupStep.COMPLETED});
          void this.router.navigate(['/home']);
        },
        error: error => {
          logger.error('Failed to finish onboarding', error);
          this.alertService.open('Failed to finish onboarding', {appearance: 'negative'}).subscribe();
        },
      });
  }
}
