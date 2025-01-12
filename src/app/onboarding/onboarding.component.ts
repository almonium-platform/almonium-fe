import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {TuiProgress, TuiStepper} from "@taiga-ui/kit";
import {ParticlesComponent} from "../shared/particles/particles.component";
import {UserInfoService} from "../services/user-info.service";
import {NgClass, NgTemplateOutlet} from "@angular/common";
import {LanguageSetupComponent} from "./language-setup/language-setup.component";
import {Subject, takeUntil} from "rxjs";
import {SetupStep, UserInfo} from "../models/userinfo.model";
import {Router} from "@angular/router";
import {WelcomeComponent} from "./welcome/welcome.component";
import {PaywallComponent} from "../shared/paywall/paywall.component";
import {ProfileSetupComponent} from "./profile-setup/profile-setup.component";
import {InterestsSetupComponent} from "./interests-setup/interests-setup.component";
import {TuiTextfield} from "@taiga-ui/core";
import {LucideAngularModule} from "lucide-angular";
import {ViewportService} from "../services/viewport.service";
import {UpgradeComponent} from "../shared/upgrade/upgrade.component";

@Component({
  selector: 'app-onboarding',
  imports: [
    TuiStepper,
    ParticlesComponent,
    TuiProgress,
    LanguageSetupComponent,
    WelcomeComponent,
    PaywallComponent,
    NgTemplateOutlet,
    ProfileSetupComponent,
    InterestsSetupComponent,
    TuiTextfield,
    LucideAngularModule,
    NgClass,
    UpgradeComponent
  ],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.less'
})
export class OnboardingComponent implements OnInit, OnDestroy {
  protected readonly SetupStep = SetupStep;
  private readonly destroy$ = new Subject<void>();// @ViewChild(LanguageSetupComponent, {static: true}) languageSetupComponent!: LanguageSetupComponent;

  userInfo: UserInfo | null = null;

  protected isMobile: boolean = false;
  activeStep: SetupStep = SetupStep.WELCOME; // Active step in the stepper
  storedStep: SetupStep = SetupStep.WELCOME; // Step stored in the backend
  steps: SetupStep[] = [
    SetupStep.WELCOME,
    SetupStep.PLAN,
    SetupStep.LANGUAGES,
    SetupStep.PROFILE,
    SetupStep.INTERESTS,
  ];

  constructor(
    private userInfoService: UserInfoService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private viewportService: ViewportService,
  ) {
  }

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
        this.router.navigate(['/home']).then();
      }
    });

    this.viewportService.setCustomWidth(768);
    this.viewportService.isMobile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isMobile: boolean) => {
        this.isMobile = isMobile;
        this.cdr.detectChanges();
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

  protected get activeStepIndex(): number {
    return this.steps.indexOf(this.activeStep);
  }

  protected updateActiveStep(step: SetupStep): void {
    if (this.activeStep !== step) {
      this.activeStep = step;
    }
  }

  protected goBack() {
    if (this.backDisabled()) {
      console.info('Back button disabled');
      return;
    }
    this.activeStep = this.steps[this.activeStepIndex - 1];
  }

  protected goForward() {
    if (this.forwardDisabled()) {
      console.info('Forward button disabled');
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
