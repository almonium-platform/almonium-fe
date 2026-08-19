import {logger} from "../../shared/logger";
import {TuiNotificationService} from "@taiga-ui/core/components";
import {Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild, inject} from '@angular/core';
import {getNextStep, isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../onboarding.service";
import {UserInfoService} from "../../services/user-info.service";
import {UsernameComponent} from "../../shared/username/username.component";
import {BehaviorSubject, finalize, Subject, takeUntil} from "rxjs";

import {ButtonComponent} from "../../shared/button/button.component";
import {AvatarPickerComponent} from '../../shared/profile/avatar-picker/avatar-picker.component';

@Component({
  selector: 'app-profile-setup',
  imports: [
    UsernameComponent,
    ButtonComponent,
    AvatarPickerComponent,
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
  @ViewChild(UsernameComponent) private usernameComponent!: UsernameComponent;
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

  async submit(): Promise<void> {
    const nextStep = getNextStep(this.step);

    this.loadingSubject$.next(true);
    const usernameSaved = await this.usernameComponent.save();
    if (!usernameSaved) {
      this.loadingSubject$.next(false);
      return;
    }

    if (isStepAfter(this.userInfo!.setupStep, this.step)) {
      this.loadingSubject$.next(false);
      this.continue.emit(nextStep);
      return;
    }

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
