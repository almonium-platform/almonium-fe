import {logger} from "../shared/logger";
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import {ParticlesComponent} from "../shared/particles/particles.component";
import {UserInfoService} from "../services/user-info.service";
import {NgTemplateOutlet} from "@angular/common";
import {LanguageSetupComponent} from "./language-setup/language-setup.component";
import {Subject, takeUntil} from "rxjs";
import {SetupStep, UserInfo} from "../models/userinfo.model";
import {Router} from "@angular/router";
import {WelcomeComponent} from "./welcome/welcome.component";
import {ProfileSetupComponent} from "./profile-setup/profile-setup.component";
import {InterestsSetupComponent} from "./interests-setup/interests-setup.component";
import {LevelSetupComponent} from './level-setup/level-setup.component';
import {GreetingComponent} from './greeting/greeting.component';
import {ReturnPathService} from '../services/return-path.service';

@Component({
  selector: 'app-onboarding',
  imports: [
    ParticlesComponent,
    LanguageSetupComponent,
    WelcomeComponent,
    NgTemplateOutlet,
    ProfileSetupComponent,
    InterestsSetupComponent,
    LevelSetupComponent,
    GreetingComponent,
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.less'
})
export class OnboardingComponent implements OnInit, OnDestroy {
  private userInfoService = inject(UserInfoService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private returnPath = inject(ReturnPathService);

  protected readonly SetupStep = SetupStep;
  private readonly destroy$ = new Subject<void>();// @ViewChild(LanguageSetupComponent, {static: true}) languageSetupComponent!: LanguageSetupComponent;

  userInfo: UserInfo | null = null;

  activeStep: SetupStep = SetupStep.WELCOME; // Active step in the stepper
  storedStep: SetupStep = SetupStep.WELCOME; // Step stored in the backend
  steps: SetupStep[] = [
    SetupStep.WELCOME,
    SetupStep.LANGUAGES,
    SetupStep.LEVEL,
    SetupStep.INTERESTS,
    SetupStep.PROFILE,
    SetupStep.GREETING,
  ];
  readonly progressSteps: SetupStep[] = [
    SetupStep.LANGUAGES,
    SetupStep.LEVEL,
    SetupStep.INTERESTS,
    SetupStep.PROFILE,
  ];

  ngOnInit() {
    this.userInfoService.userInfo$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(userInfo => {
      if (!userInfo) {
        return;
      }
      this.userInfo = userInfo;
      this.storedStep = this.userInfo.setupStep;
      this.activeStep = this.storedStep; // Default active step is the stored step initially
      this.cdr.detectChanges();
      if (this.storedStep === SetupStep.COMPLETED) {
        void this.router.navigateByUrl(this.returnPath.consume() ?? '/home').then();
      }
    });

  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected canNavigateTo(stepIndex: number): boolean {
    const maxAllowedStepIndex = this.steps.indexOf(this.storedStep);
    return stepIndex <= maxAllowedStepIndex; // Allow steps up to the stored step
  }

  protected goToStep(stepIndex: number): void {
    if (this.canNavigateTo(stepIndex)) {
      this.activeStep = this.steps[stepIndex];
    }
  }

  protected goToProgressStep(step: SetupStep): void {
    this.goToStep(this.steps.indexOf(step));
  }

  protected progressStepLabel(step: SetupStep): string {
    return step.charAt(0) + step.slice(1).toLowerCase();
  }

  protected progressStepNumber(step: SetupStep): number {
    return this.progressSteps.indexOf(step) + 1;
  }

  protected isProgressStepComplete(step: SetupStep): boolean {
    return this.progressSteps.indexOf(step) < this.progressStepIndex;
  }

  protected get activeStepIndex(): number {
    return this.steps.indexOf(this.activeStep);
  }

  protected get progressStepIndex(): number {
    return this.progressSteps.indexOf(this.activeStep);
  }

  protected get showProgressStepper(): boolean {
    return this.progressStepIndex >= 0;
  }

  protected updateActiveStep(step: SetupStep): void {
    if (this.activeStep !== step) {
      this.activeStep = step;
    }
  }

  protected goBack() {
    if (this.backDisabled()) {
      logger.info('Back button disabled');
      return;
    }
    this.activeStep = this.steps[this.activeStepIndex - 1];
  }

  protected goForward() {
    if (this.forwardDisabled()) {
      logger.info('Forward button disabled');
      return;
    }
    this.activeStep = this.steps[this.activeStepIndex + 1];
  }

  protected forwardDisabled() {
    return this.activeStep === this.userInfo?.setupStep || this.activeStep === this.steps[this.steps.length - 1]
  }

  protected backDisabled() {
    return this.activeStep === this.steps[0]
  }
}
