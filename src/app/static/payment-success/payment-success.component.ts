import {Component, OnInit} from '@angular/core';
import {NgTemplateOutlet} from "@angular/common";
import {UpgradeComponent} from "../../shared/upgrade/upgrade.component";
import {UserInfoService} from "../../services/user-info.service";

@Component({
  selector: 'app-payment-success',
  imports: [
    NgTemplateOutlet,
    UpgradeComponent
  ],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.less'
})
export class PaymentSuccessComponent implements OnInit {
  constructor(private userInfoService: UserInfoService) {
  }

  ngOnInit() {
    this.userInfoService.fetchUserInfoFromServer().subscribe();
  }
}
