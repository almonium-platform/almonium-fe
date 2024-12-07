import {Component, OnInit} from '@angular/core';
import {NavbarWrapperComponent} from "../../shared/navbars/navbar-wrapper/navbar-wrapper.component";
import {NgOptimizedImage} from "@angular/common";
import {Router} from "@angular/router";
import {UserInfoService} from "../../services/user-info.service";

@Component({
  selector: 'app-payment-success',
  imports: [
    NavbarWrapperComponent,
    NgOptimizedImage
  ],
  templateUrl: './payment-success.component.html',
  styleUrl: './payment-success.component.less'
})
export class PaymentSuccessComponent implements OnInit {
  constructor(
    protected router: Router,
    private userInfoService: UserInfoService,
  ) {
  }

  ngOnInit() {
    this.userInfoService.fetchUserInfoFromServer().subscribe();
  }
}
