import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {getNextStep, isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../onboarding.service";
import {TuiAlertService} from "@taiga-ui/core";
import {UserInfoService} from "../../services/user-info.service";
import {UsernameComponent} from "../../shared/username/username.component";
import {AvatarSettingsComponent} from "../../shared/avatar/settings/avatar-settings.component";
import {BehaviorSubject, finalize, Subject, takeUntil} from "rxjs";

import {StepHeaderComponent} from "../../shared/step-header/step-header.component";
import {ButtonComponent} from "../../shared/button/button.component";

@Component({
  selector: 'app-profile-setup',
  imports: [
    UsernameComponent,
    AvatarSettingsComponent,
    StepHeaderComponent,
    ButtonComponent
  ],
  templateUrl: './profile-setup.component.html',
  styleUrl: './profile-setup.component.less'
})
export class ProfileSetupComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.PROFILE;
  @Output() continue = new EventEmitter<SetupStep>();
  protected userInfo: UserInfo | null = null;

  private readonly loadingSubject$ = new BehaviorSubject<boolean>(false);
  protected readonly loading$ = this.loadingSubject$.asObservable();

  constructor(
    private onboardingService: OnboardingService,
    private alertService: TuiAlertService,
    private userInfoService: UserInfoService,
  ) {
  }

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
          console.error('Failed to finish profile setup', err);
          this.alertService.open('Failed to finish profile setup', {appearance: 'error'}).subscribe();
        }
      });
  }
}
