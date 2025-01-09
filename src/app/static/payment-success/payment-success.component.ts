import {Component, OnInit} from '@angular/core';
import {NgOptimizedImage} from "@angular/common";
import {ActivatedRoute, Router} from "@angular/router";
import {getNextStep, SetupStep, UserInfo} from "../../models/userinfo.model";
import {ButtonComponent} from "../../shared/button/button.component";

@Component({
  selector: 'app-payment-success',
  imports: [
    NgOptimizedImage,
    ButtonComponent
  ],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.less'
})
export class PaymentSuccessComponent implements OnInit {
  protected userInfo: UserInfo | null = null;
  protected onboardingMode = false;

  constructor(private route: ActivatedRoute,
              protected router: Router,
  ) {
  }

  ngOnInit() {
    this.userInfo = this.route.snapshot.data['userInfo'];
    if (this.userInfo) {
      this.onboardingMode = getNextStep(SetupStep.PLAN) === this.userInfo.setupStep;
    }
  }
}
