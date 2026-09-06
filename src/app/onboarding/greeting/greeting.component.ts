import {Component, OnDestroy, OnInit, inject} from '@angular/core';
import {BehaviorSubject, Subject, finalize, takeUntil} from 'rxjs';
import {Router} from '@angular/router';
import {TuiNotificationService} from '@taiga-ui/core/components';
import {UserInfoService} from '../../services/user-info.service';
import {OnboardingService} from '../onboarding.service';
import {SetupStep, UserInfo} from '../../models/userinfo.model';
import {ButtonComponent} from '../../shared/button/button.component';
import {logger} from '../../shared/logger';
import {LanguageNameService} from '../../services/language-name.service';
import {ReturnPathService} from '../../services/return-path.service';

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
  private readonly languageNameService = inject(LanguageNameService);
  private readonly returnPath = inject(ReturnPathService);
  private readonly destroy$ = new Subject<void>();
  private readonly loadingSubject$ = new BehaviorSubject(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();
  protected userInfo: UserInfo | null = null;

  protected get setupSummary(): string {
    const learner = this.userInfo?.learners[0];
    const language = learner ? this.languageNameService.getLanguageName(learner.language) : 'Your language';
    const level = learner?.selfReportedLevel ?? 'B1';
    const parts = [language, level];
    const interestCount = this.userInfo?.interests.length ?? 0;
    if (interestCount > 0) {
      parts.push(`${interestCount} ${interestCount === 1 ? 'interest' : 'interests'}`);
    }
    return `${parts.join(', ')}. Almo has it noted; change any of it later.`;
  }

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
          void this.router.navigateByUrl(this.returnPath.consume() ?? '/home');
        },
        error: error => {
          logger.error('Failed to finish onboarding', error);
          this.alertService.open('Failed to finish onboarding', {appearance: 'negative'}).subscribe();
        },
      });
  }
}
