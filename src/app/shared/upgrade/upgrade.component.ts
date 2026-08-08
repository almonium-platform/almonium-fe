import {logger} from "../logger";
import { Component, EventEmitter, Input, OnInit, Output, TemplateRef, ViewChild, inject } from '@angular/core';
import {ButtonComponent} from "../button/button.component";
import {Router} from "@angular/router";
import {getNextStep, isStepAfter, SetupStep, UserInfo} from "../../models/userinfo.model";
import {Subject, takeUntil} from "rxjs";
import {UserInfoService} from "../../services/user-info.service";

@Component({
  selector: 'app-upgrade',
  imports: [
    ButtonComponent
  ],
  templateUrl: './upgrade.component.html',
  styleUrl: './upgrade.component.less',
})
export class UpgradeComponent implements OnInit {
  private router = inject(Router);
  private userInfoService = inject(UserInfoService);

  @ViewChild('upgrade', {static: true}) content!: TemplateRef<unknown>;
  @Input() onboardingMode = false;
  @Input() celebrate = false;
  private readonly destroy$ = new Subject<void>();
  private readonly step = SetupStep.PLAN;
  @Output() continue = new EventEmitter<SetupStep>();
  protected userInfo: UserInfo | null = null;

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

  protected handleClick() {
    if (this.onboardingMode) {
      const nextStep = getNextStep(this.step);
      if (isStepAfter(this.userInfo!.setupStep, this.step)) {
        this.continue.emit(nextStep);
      } else {
        logger.error('This shouldn`t happen. If user already has a plan, his setup step should be next after plan');
        this.userInfoService.updateUserInfo({setupStep: nextStep});
      }
    } else {
      void this.router.navigate(['/home']).then();
    }
  }
}
