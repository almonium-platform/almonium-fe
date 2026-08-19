import {logger} from "../../shared/logger";
import {TuiNotificationService} from "@taiga-ui/core/components";
import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import {getNextStep, isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../onboarding.service";
import {UserInfoService} from "../../services/user-info.service";
import {UsernameComponent} from "../../shared/username/username.component";
import {BehaviorSubject, finalize, Subject, takeUntil} from "rxjs";

import {ButtonComponent} from "../../shared/button/button.component";
import {OnboardingAvatarPickerComponent} from './onboarding-avatar-picker.component';

@Component({
  selector: 'app-profile-setup',
  imports: [
    UsernameComponent,
    ButtonComponent,
    OnboardingAvatarPickerComponent,
  ],
  templateUrl: './profile-setup.component.html',
  styleUrl: './profile-setup.component.less'
})
export class ProfileSetupComponent implements OnInit, OnDestroy {
  private onboardingService = inject(OnboardingService);
  private alertService = inject(TuiNotificationService);
  private userInfoService = inject(UserInfoService);

  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.PROFILE;
  @Output() continue = new EventEmitter<SetupStep>();
  @Output() back = new EventEmitter<void>();
  protected userInfo: UserInfo | null = null;

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  ngOnInit() {
    this.userInfoService.userInfo$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (userInfo) => {
        if (!userInfo) {
          return;
        }
        this.userInfo = userInfo;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    const nextStep = getNextStep(this.step);

    if (isStepAfter(this.userInfo!.setupStep, this.step)) {
      this.continue.emit(nextStep);
      return;
    }

    this.loadingSubject$.next(true);

    this.onboardingService.completeStep(this.step)
      .pipe(finalize(() => this.loadingSubject$.next(false)))
      .subscribe({
        next: () => {
          this.userInfoService.updateUserInfo({setupStep: nextStep});
        },
        error: (err) => {
          logger.error('Failed to finish profile setup', err);
          this.alertService.open('Failed to finish profile setup', {appearance: 'negative'}).subscribe();
        }
      });
  }
}
