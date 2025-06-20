import {Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild} from "@angular/core";
import {TuiAlertService} from "@taiga-ui/core";
import {UserInfoService} from "../../services/user-info.service";
import {isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {OnboardingService} from "../onboarding.service";
import {BehaviorSubject, finalize, Subject, takeUntil} from "rxjs";
import {GifPlayerComponent} from "../../shared/gif-player/gif-player.component";
import {ButtonComponent} from "../../shared/button/button.component";

@Component({
  selector: 'app-welcome',
  imports: [
    GifPlayerComponent,
    ButtonComponent
  ],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.less'
})
export class WelcomeComponent implements OnInit, OnDestroy {
  @ViewChild('logoGif') logoGif?: ElementRef<HTMLImageElement>;
  @Output() continue = new EventEmitter<SetupStep>();

  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.WELCOME;

  protected userInfo: UserInfo | null = null;
  protected replayGifSubject = new Subject<void>();

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

  startOnboarding() {
    const nextStep = SetupStep.PLAN;

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
        error: (error) => {
          console.error('Failed to start onboarding', error);
          this.alertService.open('Failed to start onboarding', {appearance: 'error'}).subscribe()
        },
      });
  }
}
