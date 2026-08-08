import { Component, OnInit, inject } from '@angular/core';
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
  private userInfoService = inject(UserInfoService);
  protected celebrate = false;

  private readonly celebrationStorageKey = 'almonium.payment-success.celebrated';

  ngOnInit() {
    this.userInfoService.fetchUserInfoFromServer().subscribe(userInfo => {
      if (userInfo?.premium && !sessionStorage.getItem(this.celebrationStorageKey)) {
        sessionStorage.setItem(this.celebrationStorageKey, 'true');
        this.celebrate = true;
      }
    });
  }
}
