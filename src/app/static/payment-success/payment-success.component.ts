import { Component, OnInit, inject } from '@angular/core';
import {NgTemplateOutlet} from "@angular/common";
import {UpgradeComponent} from "../../shared/upgrade/upgrade.component";
import {UserInfoService} from "../../services/user-info.service";
import {LocalStorageService} from "../../services/local-storage.service";

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
  private localStorageService = inject(LocalStorageService);
  protected celebrate = false;

  private readonly celebrationStorageKey = 'payment_success_celebrated';

  ngOnInit() {
    if (!this.localStorageService.getItem<boolean>(this.celebrationStorageKey)) {
      this.localStorageService.saveItem(this.celebrationStorageKey, true);
      this.celebrate = true;
    }

    this.userInfoService.fetchUserInfoFromServer().subscribe();
  }
}
